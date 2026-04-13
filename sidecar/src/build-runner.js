import { launchBrowser, attachBrowser } from "./tesco/browser.js";
import { login } from "./tesco/login.js";
import { search } from "./tesco/search.js";
import { addToBasket } from "./tesco/add_to_basket.js";
import { goToCheckout } from "./tesco/checkout.js";
import { checkExistingBasket, emptyBasket } from "./tesco/check_existing_basket.js";
import { postToRails } from "./rails-callback.js";

// Default fallback when no LLM-backed matcher is supplied: pick the first search result.
function defaultMatcher(searchResults /* , item */) {
  if (!searchResults?.length) return null;
  return { tesco_product_id: searchResults[0].tesco_product_id, confidence: 1.0 };
}

// In-process registry of paused builds awaiting a user decision. The Fastify
// /build/:id/resume route resolves the matching promise.
const pendingDecisions = new Map();

export function resolveExistingBasketDecision(buildId, action) {
  const entry = pendingDecisions.get(buildId);
  if (!entry) return false;
  pendingDecisions.delete(buildId);
  entry.resolve(action);
  return true;
}

function awaitDecision(buildId, { timeoutMs = 30 * 60 * 1000 } = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingDecisions.delete(buildId);
      reject(new Error("decision_timeout"));
    }, timeoutMs);
    pendingDecisions.set(buildId, {
      resolve: (action) => {
        clearTimeout(timer);
        resolve(action);
      },
      reject,
    });
  });
}

export async function runBuild({
  buildId,
  tescoEmail,
  tescoPassword,
  items,
  baseUrl = process.env.TESCO_BASE_URL ?? "http://localhost:4002",
  loginPath = process.env.TESCO_LOGIN_PATH ?? "/login",
  cdpUrl = process.env.CHROME_CDP_URL ?? null,
  railsCallbackBase,
  hmacSecret,
  matcher = defaultMatcher,
  proxy,
  existingBasketDecisionTimeoutMs,
  preferences,
  storageState,
}) {
  const callbackUrl = (suffix) => `${railsCallbackBase}/internal/builds/${buildId}/${suffix}`;
  const post = (suffix, body) =>
    postToRails({ url: callbackUrl(suffix), secret: hmacSecret, body });

  // Prefer saved session cookies over CDP attach — storageState means we can
  // run headless without needing a running Chrome instance.
  const handle = storageState
    ? await launchBrowser({ proxy, storageState, headless: true })
    : cdpUrl
      ? await attachBrowser({ cdpUrl })
      : await launchBrowser({ proxy });
  const { context, attached, cleanup } = handle;
  const page = await context.newPage();
  const unmatched = [];

  try {
    if (storageState) {
      // Cookies restored from saved session — skip login entirely.
      await post("progress", { build_id: buildId, event: "session_restored" });
    } else if (attached) {
      // The user has already logged into Tesco manually in their own Chrome.
      // We reuse that session, so the entire login flow (and Akamai bot
      // defenses) is sidestepped.
      await post("progress", { build_id: buildId, event: "attached" });
    } else {
      const loginResult = await login(page, { baseUrl, email: tescoEmail, password: tescoPassword, loginPath });
      if (!loginResult.ok) {
        if (loginResult.reason === "verification_required") {
          await post("verification_required", { build_id: buildId });
          let decision;
          try {
            decision = await awaitDecision(buildId, { timeoutMs: existingBasketDecisionTimeoutMs });
          } catch (_e) {
            await post("failed", { build_id: buildId, error_message: "verification_timeout" });
            return { status: "failed", reason: "verification_timeout" };
          }
          if (decision === "cancel") {
            await post("failed", { build_id: buildId, error_message: "cancelled_by_user" });
            return { status: "cancelled" };
          }
          const retry = await login(page, { baseUrl, email: tescoEmail, password: tescoPassword, loginPath });
          if (!retry.ok) {
            await post("failed", { build_id: buildId, error_message: `login_failed_after_resume: ${retry.reason}` });
            return { status: "failed", reason: retry.reason };
          }
          await post("progress", { build_id: buildId, event: "logged_in_after_verification" });
        } else {
          throw new Error(`login_failed: ${loginResult.reason}`);
        }
      } else {
        await post("progress", { build_id: buildId, event: "logged_in" });
      }
    }

    // Pre-build basket check: pause for a user decision if items already present.
    const { itemCount } = await checkExistingBasket(page, { baseUrl });
    if (itemCount > 0) {
      await post("existing_basket_detected", { build_id: buildId, item_count: itemCount });
      let decision;
      try {
        decision = await awaitDecision(buildId, { timeoutMs: existingBasketDecisionTimeoutMs });
      } catch (_e) {
        await post("failed", { build_id: buildId, error_message: "existing_basket_decision_timeout" });
        return { status: "failed", reason: "decision_timeout" };
      }
      if (decision === "cancel") {
        await post("failed", { build_id: buildId, error_message: "cancelled_by_user" });
        return { status: "cancelled" };
      }
      if (decision === "replace") {
        await emptyBasket(page, { baseUrl });
        await post("progress", { build_id: buildId, event: "basket_replaced" });
      } else {
        await post("progress", { build_id: buildId, event: "basket_merged" });
      }
    }

    for (const item of items) {
      try {
        let results = await search(page, { baseUrl, query: item.freeform, limit: 10 });
        // If organic is preferred and the query doesn't already mention it,
        // also search with "organic" to find organic variants that may not
        // appear in a generic search.
        if (preferences?.organic_preference && !/organic/i.test(item.freeform)) {
          const organicResults = await search(page, { baseUrl, query: `organic ${item.freeform}`, limit: 5 });
          // Merge, deduplicating by product ID, organic results first.
          const seen = new Set(organicResults.map((r) => r.tesco_product_id));
          results = [...organicResults, ...results.filter((r) => !seen.has(r.tesco_product_id))];
        }
        const match = await matcher(results, item);
        if (!match) {
          unmatched.push({ freeform: item.freeform, reason: "no_results" });
          await post("progress", { build_id: buildId, event: "unmatched", freeform: item.freeform });
          continue;
        }

        // Try adding; if out of stock, do a fresh search for alternatives
        // before falling back to remaining candidates.
        let added = false;
        const tried = new Set();
        let currentMatch = match;
        let retriedSearch = false;
        while (currentMatch && !added) {
          tried.add(currentMatch.tesco_product_id);
          const addResult = await addToBasket(page, { baseUrl, productId: currentMatch.tesco_product_id, quantity: item.quantity });
          if (addResult.ok) {
            added = true;
            await post("progress", {
              build_id: buildId,
              event: "added",
              freeform: item.freeform,
              tesco_product_id: currentMatch.tesco_product_id,
            });
          } else if (addResult.reason === "out_of_stock") {
            console.log(`[build] "${item.freeform}" product ${currentMatch.tesco_product_id} out of stock`);

            // Do one fresh broader search to find alternatives we haven't seen.
            if (!retriedSearch) {
              retriedSearch = true;
              const freshResults = await search(page, { baseUrl, query: item.freeform, limit: 20 });
              const existingIds = new Set(results.map((r) => r.tesco_product_id));
              const newResults = freshResults.filter((r) => !existingIds.has(r.tesco_product_id));
              results = [...results, ...newResults];
              console.log(`[build] Fresh search found ${newResults.length} new candidates`);
            }

            // Remove all tried products and pick again.
            results = results.filter((r) => !tried.has(r.tesco_product_id));
            if (!results.length) { currentMatch = null; break; }
            currentMatch = await matcher(results, item);
            // Guard: if the matcher returns something we already tried (e.g. from cache), stop.
            if (currentMatch && tried.has(currentMatch.tesco_product_id)) {
              currentMatch = null;
            }
          } else {
            break;
          }
        }
        if (!added) {
          unmatched.push({ freeform: item.freeform, reason: "all_out_of_stock" });
          await post("progress", { build_id: buildId, event: "unmatched", freeform: item.freeform });
        }
      } catch (e) {
        console.log(`[build] "${item.freeform}" threw error (skipping OOS retry): ${e.message}`);
        unmatched.push({ freeform: item.freeform, reason: e.message });
        await post("progress", { build_id: buildId, event: "item_error", freeform: item.freeform, error: e.message });
      }
    }

    const { checkout_url, total_pence } = await goToCheckout(page, { baseUrl });
    await post("completed", {
      build_id: buildId,
      tesco_checkout_url: checkout_url,
      total_pence,
      unmatched_items: unmatched,
    });
    return { status: "completed", checkout_url, total_pence, unmatched };
  } catch (e) {
    if (e.message === "session_expired") {
      await post("session_expired", { build_id: buildId });
      return { status: "session_expired" };
    }
    await post("failed", { build_id: buildId, error_message: e.message });
    return { status: "failed", reason: e.message };
  } finally {
    await page.close().catch(() => {});
    await cleanup();
  }
}
