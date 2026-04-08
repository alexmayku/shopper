import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Fastify from "fastify";
import { buildMockTesco } from "../mock-tesco/server.js";
import { runBuild, resolveExistingBasketDecision } from "../src/build-runner.js";
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
      try { done(null, JSON.parse(body)); } catch (e) { done(e, undefined); }
    }
  );
  mockRails.post("/internal/builds/:buildId/:event", async (request, reply) => {
    if (!verify(request.rawBody, request.headers["x-signature"], SECRET)) {
      return reply.code(401).send();
    }
    received.push({ event: request.params.event, body: request.body });
    return reply.code(200).send({ ok: true });
  });
  await mockRails.listen({ host: "127.0.0.1", port: 0 });
  mockRailsUrl = `http://127.0.0.1:${mockRails.server.address().port}`;
}, 30_000);

afterAll(async () => {
  await mockTesco?.close();
  await mockRails?.close();
});

beforeEach(async () => {
  received.length = 0;
  await fetch(`${mockTescoUrl}/__test/reset`, { method: "POST" });
});

async function preseed(items) {
  await fetch(`${mockTescoUrl}/__test/preseed`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ items }),
  });
}

async function waitFor(predicate, { timeout = 30_000, interval = 100 } = {}) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeout) throw new Error("waitFor timed out");
    await new Promise((r) => setTimeout(r, interval));
  }
}

describe("existing basket pause / resume", () => {
  it("posts existing_basket_detected, then on 'replace' empties the basket and completes", async () => {
    await preseed([{ product_id: "p101", quantity: 1 }]);

    const buildPromise = runBuild({
      buildId: 200,
      tescoEmail: "a@b.com",
      tescoPassword: "x",
      items: [{ freeform: "milk", quantity: 1 }],
      baseUrl: mockTescoUrl,
      railsCallbackBase: mockRailsUrl,
      hmacSecret: SECRET,
    });

    await waitFor(() => received.some((r) => r.event === "existing_basket_detected"));
    expect(resolveExistingBasketDecision(200, "replace")).toBe(true);

    const result = await buildPromise;
    expect(result.status).toBe("completed");
    expect(received.some((r) => r.body.event === "basket_replaced")).toBe(true);
    expect(received.some((r) => r.event === "completed")).toBe(true);
  }, 60_000);

  it("on 'cancel' the build aborts and posts failed", async () => {
    await preseed([{ product_id: "p101", quantity: 1 }]);

    const buildPromise = runBuild({
      buildId: 201,
      tescoEmail: "a@b.com",
      tescoPassword: "x",
      items: [{ freeform: "milk", quantity: 1 }],
      baseUrl: mockTescoUrl,
      railsCallbackBase: mockRailsUrl,
      hmacSecret: SECRET,
    });

    await waitFor(() => received.some((r) => r.event === "existing_basket_detected"));
    expect(resolveExistingBasketDecision(201, "cancel")).toBe(true);

    const result = await buildPromise;
    expect(result.status).toBe("cancelled");
    expect(received.some((r) => r.event === "failed" && r.body.error_message === "cancelled_by_user")).toBe(true);
  }, 60_000);

  it("times out and fails when no decision arrives", async () => {
    await preseed([{ product_id: "p101", quantity: 1 }]);

    const result = await runBuild({
      buildId: 202,
      tescoEmail: "a@b.com",
      tescoPassword: "x",
      items: [{ freeform: "milk", quantity: 1 }],
      baseUrl: mockTescoUrl,
      railsCallbackBase: mockRailsUrl,
      hmacSecret: SECRET,
      existingBasketDecisionTimeoutMs: 250,
    });
    expect(result.status).toBe("failed");
    expect(received.some((r) => r.event === "existing_basket_detected")).toBe(true);
    expect(received.some((r) => r.event === "failed" && r.body.error_message === "existing_basket_decision_timeout")).toBe(true);
  }, 60_000);

  it("resolveExistingBasketDecision returns false when no build is paused", () => {
    expect(resolveExistingBasketDecision(99999, "replace")).toBe(false);
  });
});
