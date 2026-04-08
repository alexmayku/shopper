import { launchBrowser } from "./tesco/browser.js";
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
  railsCallbackBase,
  hmacSecret,
  matcher = defaultMatcher,
  proxy,
  existingBasketDecisionTimeoutMs,
}) {
  const callbackUrl = (suffix) => `${railsCallbackBase}/internal/builds/${buildId}/${suffix}`;
  const post = (suffix, body) =>
    postToRails({ url: callbackUrl(suffix), secret: hmacSecret, body });

  const { browser, context } = await launchBrowser({ proxy });
  const page = await context.newPage();
  const unmatched = [];

  try {
    const loginResult = await login(page, { baseUrl, email: tescoEmail, password: tescoPassword });
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
        const retry = await login(page, { baseUrl, email: tescoEmail, password: tescoPassword });
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
        const results = await search(page, { baseUrl, query: item.freeform });
        const match = await matcher(results, item);
        if (!match) {
          unmatched.push({ freeform: item.freeform, reason: "no_results" });
          await post("progress", { build_id: buildId, event: "unmatched", freeform: item.freeform });
          continue;
        }
        await addToBasket(page, { baseUrl, productId: match.tesco_product_id, quantity: item.quantity });
        await post("progress", {
          build_id: buildId,
          event: "added",
          freeform: item.freeform,
          tesco_product_id: match.tesco_product_id,
        });
      } catch (e) {
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
    await post("failed", { build_id: buildId, error_message: e.message });
    return { status: "failed", reason: e.message };
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}
