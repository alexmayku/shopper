const TOOL = {
  name: "pick_product",
  description: "Pick the best Tesco product matching the shopper's freeform item.",
  input_schema: {
    type: "object",
    required: ["tesco_product_id", "confidence", "reasoning"],
    properties: {
      tesco_product_id: { type: "string" },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      reasoning: { type: "string" },
    },
  },
};

const MIN_CONFIDENCE = 0.5;

function buildSystemPrompt(prefs) {
  const range = prefs?.price_range ?? "mid";
  const organic = prefs?.organic_preference;

  const priceGuidance = {
    budget: "Pick the cheapest option that matches the item. Prefer own-brand/value ranges (e.g. 'Stockwell', 'Exclusively at Tesco', 'Grower's Harvest') over branded or premium products.",
    mid: "Pick a good-value mid-range option. Own-brand standard lines are fine. Avoid the cheapest value range and the most expensive premium/Finest options unless they are the only match.",
    premium: "Pick the highest-quality option available. Strongly prefer Tesco Finest, branded premium (e.g. Napolina, De Cecco), or speciality products. 'Premium' means luxury/indulgent, NOT 'healthy' — do NOT substitute whole wheat, low-fat, or health-food alternatives unless the shopper specifically asked for them. Only fall back to standard lines if no premium option exists.",
  }[range] ?? "Pick a reasonable mid-range option.";

  const organicGuidance = organic
    ? "Strongly prefer organic products when available. If an organic version exists in the shortlist, pick it even if it costs more."
    : "No organic preference — choose based on price range and relevance.";

  return [
    "You are a grocery shopping assistant matching a shopper's freeform item to the best Tesco product from a shortlist.",
    "Pick the product that most closely matches what a real person would mean by the item description. Do NOT change the fundamental product type — if the shopper says 'spaghetti', pick spaghetti (not penne, not whole wheat unless they said whole wheat). Apply price/organic preferences only within the correct product type.",
    priceGuidance,
    organicGuidance,
    "If nothing in the shortlist is a reasonable fit, respond with confidence below 0.5.",
  ].join("\n\n");
}

function buildUserPrompt(freeform, results) {
  const lines = results.map(
    (r, i) =>
      `${i + 1}. id=${r.tesco_product_id} name="${r.name}" price=${r.price_text ?? "?"}`
  );
  return `Item: "${freeform}"\nShortlist:\n${lines.join("\n")}`;
}

// matchItemFor(searchResults, item, deps) → { tesco_product_id, confidence, reasoning } | null
export async function matchItem({ freeform, results, prefs, anthropic }) {
  if (!results?.length) return null;

  const system = buildSystemPrompt(prefs);
  const user = buildUserPrompt(freeform, results);
  console.log(`[matcher] Item: "${freeform}" | prefs: ${JSON.stringify(prefs)} | ${results.length} candidates`);
  console.log(`[matcher] Candidates:\n${user}`);

  const choice = await anthropic({ system, user, tool: TOOL });
  console.log(`[matcher] Claude chose:`, JSON.stringify(choice));
  if (!choice) return null;
  if (typeof choice.confidence !== "number" || choice.confidence < MIN_CONFIDENCE) return null;
  // Defensive: only accept ids that were actually in the shortlist.
  if (!results.some((r) => r.tesco_product_id === choice.tesco_product_id)) return null;
  return choice;
}

// Build a `matcher(searchResults, item)` for use by build-runner that consults the
// Rails ProductMatch cache first, then falls back to Claude, then writes to cache.
export function makeCachedMatcher({ userId, prefs, cache, anthropic }) {
  return async function (results, item) {
    const cached = await cache.get({ userId, freeformText: item.freeform }).catch(() => null);
    if (cached?.tesco_product_id) {
      // Only use cache if the product is still in the current results (it may
      // have been filtered out due to being out of stock).
      if (results.some((r) => r.tesco_product_id === cached.tesco_product_id)) {
        console.log(`[matcher] Cache hit for "${item.freeform}" → ${cached.tesco_product_id}`);
        return { tesco_product_id: cached.tesco_product_id, confidence: cached.confidence ?? 1.0, source: "cache" };
      }
      console.log(`[matcher] Cache hit for "${item.freeform}" → ${cached.tesco_product_id} but not in current results, falling through to Claude`);
    }
    console.log(`[matcher] Cache miss for "${item.freeform}" — calling Claude`);

    let choice;
    try {
      choice = await matchItem({ freeform: item.freeform, results, prefs, anthropic });
    } catch (_e) {
      return null;
    }
    if (!choice) return null;

    const top = results.find((r) => r.tesco_product_id === choice.tesco_product_id);
    await cache
      .put({
        userId,
        match: {
          freeform_text: item.freeform,
          tesco_product_id: choice.tesco_product_id,
          tesco_product_name: top?.name ?? choice.tesco_product_id,
          confidence: choice.confidence,
        },
      })
      .catch(() => {});
    return { ...choice, source: "llm" };
  };
}
