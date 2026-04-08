import { launchBrowser } from "./tesco/browser.js";
import { login } from "./tesco/login.js";
import { search } from "./tesco/search.js";
import { addToBasket } from "./tesco/add_to_basket.js";
import { goToCheckout } from "./tesco/checkout.js";
import { postToRails } from "./rails-callback.js";

// matchItem(searchResults, item) → { tesco_product_id, confidence } | null
// Default fallback when no LLM-backed matcher is supplied: pick the first search result.
function defaultMatcher(searchResults /* , item */) {
  if (!searchResults?.length) return null;
  return { tesco_product_id: searchResults[0].tesco_product_id, confidence: 1.0 };
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
        await post("failed", { build_id: buildId, error_message: "verification_required" });
        return { status: "failed", reason: "verification_required" };
      }
      throw new Error(`login_failed: ${loginResult.reason}`);
    }
    await post("progress", { build_id: buildId, event: "logged_in" });

    for (const item of items) {
      try {
        const results = await search(page, { baseUrl, query: item.freeform });
        const match = matcher(results, item);
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
