import { describe, it, expect, vi } from "vitest";
import { matchItem, makeCachedMatcher } from "../src/matching/match.js";
import { makeCacheClient } from "../src/matching/cache-client.js";

const RESULTS = [
  { tesco_product_id: "p001", name: "Tesco Whole Milk 2.272L", price_text: "£1.85" },
  { tesco_product_id: "p002", name: "Tesco Organic Whole Milk 1L", price_text: "£1.55" },
  { tesco_product_id: "p003", name: "Tesco Semi Skimmed Milk 2.272L", price_text: "£1.85" },
];

describe("matchItem", () => {
  it("returns the LLM choice when confidence is high enough", async () => {
    const anthropic = vi.fn().mockResolvedValue({
      tesco_product_id: "p002",
      confidence: 0.92,
      reasoning: "organic preference",
    });
    const out = await matchItem({
      freeform: "milk",
      results: RESULTS,
      prefs: { price_range: "premium", organic_preference: true },
      anthropic,
    });
    expect(out.tesco_product_id).toBe("p002");
    expect(anthropic).toHaveBeenCalledOnce();
    const args = anthropic.mock.calls[0][0];
    expect(args.system).toMatch(/premium/);
    expect(args.system).toMatch(/organic/);
    expect(args.user).toMatch(/p002/);
  });

  it("returns null when confidence is below the threshold", async () => {
    const anthropic = vi.fn().mockResolvedValue({
      tesco_product_id: "p001",
      confidence: 0.2,
      reasoning: "weak match",
    });
    const out = await matchItem({ freeform: "milk", results: RESULTS, prefs: {}, anthropic });
    expect(out).toBeNull();
  });

  it("returns null when the LLM picks an id not in the shortlist", async () => {
    const anthropic = vi.fn().mockResolvedValue({
      tesco_product_id: "phallucinated",
      confidence: 0.99,
      reasoning: "made up",
    });
    const out = await matchItem({ freeform: "milk", results: RESULTS, prefs: {}, anthropic });
    expect(out).toBeNull();
  });

  it("returns null when the search yielded no results", async () => {
    const anthropic = vi.fn();
    const out = await matchItem({ freeform: "milk", results: [], prefs: {}, anthropic });
    expect(out).toBeNull();
    expect(anthropic).not.toHaveBeenCalled();
  });
});

describe("makeCachedMatcher", () => {
  function fakeFetch(handlers) {
    return vi.fn(async (url, opts = {}) => {
      const handler = handlers[`${opts.method ?? "GET"} ${url.replace(/^https?:\/\/[^/]+/, "")}`]
                  ?? handlers[url];
      if (!handler) throw new Error(`unexpected fetch: ${opts.method ?? "GET"} ${url}`);
      return handler(opts);
    });
  }

  it("uses the cache when present and skips Anthropic", async () => {
    const fetchFn = fakeFetch({
      [`GET /internal/users/42/product_matches?freeform_text=milk`]: () => ({
        ok: true,
        status: 200,
        json: async () => ({ tesco_product_id: "p003", confidence: 1.0 }),
      }),
    });
    const cache = makeCacheClient({ railsCallbackBase: "http://rails", hmacSecret: "s", fetchFn });
    const anthropic = vi.fn();
    const matcher = makeCachedMatcher({ userId: 42, prefs: {}, cache, anthropic });

    const out = await matcher(RESULTS, { freeform: "milk", quantity: 1 });
    expect(out.tesco_product_id).toBe("p003");
    expect(out.source).toBe("cache");
    expect(anthropic).not.toHaveBeenCalled();
  });

  it("falls back to Anthropic on cache miss and writes the result back", async () => {
    let posted = null;
    const fetchFn = fakeFetch({
      [`GET /internal/users/42/product_matches?freeform_text=milk`]: () => ({
        ok: false,
        status: 404,
        json: async () => ({}),
      }),
      [`POST /internal/users/42/product_matches`]: (opts) => {
        posted = JSON.parse(opts.body);
        return { ok: true, status: 201, json: async () => ({ id: 1 }) };
      },
    });
    const cache = makeCacheClient({ railsCallbackBase: "http://rails", hmacSecret: "s", fetchFn });
    const anthropic = vi.fn().mockResolvedValue({
      tesco_product_id: "p001",
      confidence: 0.9,
      reasoning: "exact",
    });

    const matcher = makeCachedMatcher({ userId: 42, prefs: { price_range: "budget" }, cache, anthropic });
    const out = await matcher(RESULTS, { freeform: "milk", quantity: 1 });

    expect(out.tesco_product_id).toBe("p001");
    expect(out.source).toBe("llm");
    expect(anthropic).toHaveBeenCalledOnce();
    expect(posted).toMatchObject({
      freeform_text: "milk",
      tesco_product_id: "p001",
      tesco_product_name: "Tesco Whole Milk 2.272L",
      confidence: 0.9,
    });
  });

  it("returns null on Anthropic error and does not write to cache", async () => {
    let postCalled = false;
    const fetchFn = fakeFetch({
      [`GET /internal/users/42/product_matches?freeform_text=milk`]: () => ({
        ok: false,
        status: 404,
        json: async () => ({}),
      }),
      [`POST /internal/users/42/product_matches`]: () => {
        postCalled = true;
        return { ok: true, status: 201, json: async () => ({}) };
      },
    });
    const cache = makeCacheClient({ railsCallbackBase: "http://rails", hmacSecret: "s", fetchFn });
    const anthropic = vi.fn().mockRejectedValue(new Error("anthropic 503"));

    const matcher = makeCachedMatcher({ userId: 42, prefs: {}, cache, anthropic });
    const out = await matcher(RESULTS, { freeform: "milk", quantity: 1 });
    expect(out).toBeNull();
    expect(postCalled).toBe(false);
  });
});
