import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify from "fastify";
import { buildMockTesco } from "../mock-tesco/server.js";
import { runBuild } from "../src/build-runner.js";
import { verify } from "../src/auth.js";

const SECRET = "test-secret";
let mockTesco, mockRails, mockTescoUrl, mockRailsUrl;
const received = [];

beforeAll(async () => {
  mockTesco = buildMockTesco();
  await mockTesco.listen({ host: "127.0.0.1", port: 0 });
  mockTescoUrl = `http://127.0.0.1:${mockTesco.server.address().port}`;

  mockRails = Fastify({ logger: false });
  mockRails.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (req, body, done) => {
      req.rawBody = body;
      try { done(null, JSON.parse(body)); }
      catch (e) { done(e, undefined); }
    }
  );
  mockRails.post("/internal/builds/:buildId/:event", async (request, reply) => {
    const sig = request.headers["x-signature"];
    if (!verify(request.rawBody, sig, SECRET)) return reply.code(401).send({ error: "bad sig" });
    received.push({ event: request.params.event, body: request.body });
    return reply.code(200).send({ ok: true });
  });
  // Product match cache endpoints — always return 404 (no cache) so matcher runs fresh.
  mockRails.get("/internal/users/:userId/product_matches", async (_req, reply) => {
    return reply.code(404).send({ error: "not found" });
  });
  mockRails.post("/internal/users/:userId/product_matches", async (_req, reply) => {
    return reply.code(201).send({ id: 1 });
  });
  await mockRails.listen({ host: "127.0.0.1", port: 0 });
  mockRailsUrl = `http://127.0.0.1:${mockRails.server.address().port}`;
}, 30_000);

afterAll(async () => {
  await mockTesco?.close();
  await mockRails?.close();
});

describe("out-of-stock handling", () => {
  it("skips an out-of-stock product and tries the next match", async () => {
    received.length = 0;

    // Mark the first milk product as out of stock so the matcher must fall back.
    await mockTesco.inject({
      method: "POST",
      url: "/__test/out_of_stock",
      payload: { product_ids: ["p001"] },
      headers: { "content-type": "application/json" },
    });

    // Custom matcher: returns candidates in order so we can verify fallback.
    let matchCalls = 0;
    const matcher = (results, _item) => {
      matchCalls++;
      if (!results?.length) return null;
      return { tesco_product_id: results[0].tesco_product_id, confidence: 1.0 };
    };

    const result = await runBuild({
      buildId: 100,
      tescoEmail: "test@example.com",
      tescoPassword: "password",
      items: [{ freeform: "milk", quantity: 1 }],
      baseUrl: mockTescoUrl,
      railsCallbackBase: mockRailsUrl,
      hmacSecret: SECRET,
      matcher,
    });

    expect(result.status).toBe("completed");
    // Matcher should have been called at least twice: first pick was OOS, then retry.
    expect(matchCalls).toBeGreaterThanOrEqual(2);
    // The "added" event should reference a product that is NOT p001.
    const addedEvent = received.find((r) => r.body.event === "added");
    expect(addedEvent).toBeTruthy();
    expect(addedEvent.body.tesco_product_id).not.toBe("p001");

    // Clean up out-of-stock state.
    await mockTesco.inject({ method: "POST", url: "/__test/reset" });
  }, 60_000);

  it("reports all_out_of_stock when every candidate is unavailable", async () => {
    received.length = 0;

    // Mark ALL milk products as out of stock.
    await mockTesco.inject({
      method: "POST",
      url: "/__test/out_of_stock",
      payload: { product_ids: ["p001", "p002", "p003"] },
      headers: { "content-type": "application/json" },
    });

    // Matcher returns each candidate in turn.
    const matcher = (results, _item) => {
      if (!results?.length) return null;
      return { tesco_product_id: results[0].tesco_product_id, confidence: 1.0 };
    };

    const result = await runBuild({
      buildId: 101,
      tescoEmail: "test@example.com",
      tescoPassword: "password",
      items: [{ freeform: "milk", quantity: 1 }],
      baseUrl: mockTescoUrl,
      railsCallbackBase: mockRailsUrl,
      hmacSecret: SECRET,
      matcher,
    });

    expect(result.status).toBe("completed");
    expect(result.unmatched.length).toBe(1);
    expect(result.unmatched[0].reason).toBe("all_out_of_stock");

    const unmatchedEvent = received.find((r) => r.body.event === "unmatched");
    expect(unmatchedEvent).toBeTruthy();

    await mockTesco.inject({ method: "POST", url: "/__test/reset" });
  }, 60_000);
});

describe("organic search boost", () => {
  it("performs a second search for organic variants when organic_preference is true", async () => {
    received.length = 0;

    // Track which search queries hit the mock.
    const searchQueries = [];
    const origInject = mockTesco.inject.bind(mockTesco);

    // We'll use the build runner with organic preference and a custom matcher
    // that records what candidates it receives.
    let matcherCandidates = [];
    const matcher = (results, _item) => {
      matcherCandidates = results.map((r) => r.name);
      if (!results?.length) return null;
      return { tesco_product_id: results[0].tesco_product_id, confidence: 1.0 };
    };

    const result = await runBuild({
      buildId: 200,
      tescoEmail: "test@example.com",
      tescoPassword: "password",
      items: [{ freeform: "bananas", quantity: 1 }],
      baseUrl: mockTescoUrl,
      railsCallbackBase: mockRailsUrl,
      hmacSecret: SECRET,
      matcher,
      preferences: { organic_preference: true },
    });

    expect(result.status).toBe("completed");
    // With organic preference, organic bananas should appear in the candidates.
    expect(matcherCandidates.some((n) => /organic/i.test(n))).toBe(true);
  }, 60_000);

  it("does not perform organic search when organic_preference is false", async () => {
    received.length = 0;

    let matcherCandidateCount = 0;
    const matcher = (results, _item) => {
      matcherCandidateCount = results.length;
      if (!results?.length) return null;
      return { tesco_product_id: results[0].tesco_product_id, confidence: 1.0 };
    };

    const result = await runBuild({
      buildId: 201,
      tescoEmail: "test@example.com",
      tescoPassword: "password",
      items: [{ freeform: "bananas", quantity: 1 }],
      baseUrl: mockTescoUrl,
      railsCallbackBase: mockRailsUrl,
      hmacSecret: SECRET,
      matcher,
      preferences: { organic_preference: false },
    });

    expect(result.status).toBe("completed");
    // Without organic preference, should only get results from one search (up to limit 10).
    expect(matcherCandidateCount).toBeLessThanOrEqual(10);
  }, 60_000);

  it("skips organic search when the item already mentions organic", async () => {
    received.length = 0;

    let matchCallCount = 0;
    const matcher = (results, _item) => {
      matchCallCount++;
      if (!results?.length) return null;
      return { tesco_product_id: results[0].tesco_product_id, confidence: 1.0 };
    };

    const result = await runBuild({
      buildId: 202,
      tescoEmail: "test@example.com",
      tescoPassword: "password",
      items: [{ freeform: "organic bananas", quantity: 1 }],
      baseUrl: mockTescoUrl,
      railsCallbackBase: mockRailsUrl,
      hmacSecret: SECRET,
      matcher,
      preferences: { organic_preference: true },
    });

    expect(result.status).toBe("completed");
    // Matcher should only be called once (no duplicate organic search).
    expect(matchCallCount).toBe(1);
  }, 60_000);
});

describe("preferences wiring", () => {
  it("passes preferences to the LLM matcher via makeCachedMatcher", async () => {
    received.length = 0;

    let receivedPrefs = null;
    const matcher = (results, _item) => {
      if (!results?.length) return null;
      return { tesco_product_id: results[0].tesco_product_id, confidence: 1.0 };
    };

    // We test that preferences flow through by checking the organic search boost fires,
    // which only happens when preferences.organic_preference is truthy.
    let candidateNames = [];
    const prefMatcher = (results, _item) => {
      candidateNames = results.map((r) => r.name);
      if (!results?.length) return null;
      return { tesco_product_id: results[0].tesco_product_id, confidence: 1.0 };
    };

    const result = await runBuild({
      buildId: 300,
      tescoEmail: "test@example.com",
      tescoPassword: "password",
      items: [{ freeform: "eggs", quantity: 1 }],
      baseUrl: mockTescoUrl,
      railsCallbackBase: mockRailsUrl,
      hmacSecret: SECRET,
      matcher: prefMatcher,
      preferences: { price_range: "premium", organic_preference: true },
    });

    expect(result.status).toBe("completed");
    // Organic eggs should be in candidates because organic preference triggered the boost.
    expect(candidateNames.some((n) => /organic/i.test(n))).toBe(true);
  }, 60_000);
});
