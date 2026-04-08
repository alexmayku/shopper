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
  return [
    "You match a shopper's freeform grocery item to one Tesco product from a shortlist.",
    `Price preference: ${prefs?.price_range ?? "mid"}.`,
    `Organic preference: ${prefs?.organic_preference ? "prefer organic when reasonable" : "no preference"}.`,
    "If nothing in the shortlist is a reasonable fit, respond with confidence below 0.5.",
  ].join(" ");
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

  const choice = await anthropic({
    system: buildSystemPrompt(prefs),
    user: buildUserPrompt(freeform, results),
    tool: TOOL,
  });
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
      return { tesco_product_id: cached.tesco_product_id, confidence: cached.confidence ?? 1.0, source: "cache" };
    }

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
