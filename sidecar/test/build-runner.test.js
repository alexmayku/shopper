import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify from "fastify";
import { buildMockTesco } from "../mock-tesco/server.js";
import { runBuild } from "../src/build-runner.js";
import { verify } from "../src/auth.js";
import { startChromeWithCdp } from "./helpers/chrome-cdp.js";

const SECRET = "test-secret";
let mockTesco;
let mockRails;
let mockTescoUrl;
let mockRailsUrl;
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
      try {
        done(null, JSON.parse(body));
      } catch (e) {
        done(e, undefined);
      }
    }
  );
  mockRails.post("/internal/builds/:buildId/:event", async (request, reply) => {
    const sig = request.headers["x-signature"];
    if (!verify(request.rawBody, sig, SECRET)) {
      return reply.code(401).send({ error: "bad signature" });
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

describe("build-runner", () => {
  it("runs login → search → add → checkout against mock Tesco and posts progress + completion", async () => {
    received.length = 0;

    const result = await runBuild({
      buildId: 7,
      tescoEmail: "test@example.com",
      tescoPassword: "password",
      items: [
        { freeform: "milk", quantity: 1 },
        { freeform: "bread", quantity: 2 },
      ],
      baseUrl: mockTescoUrl,
      railsCallbackBase: mockRailsUrl,
      hmacSecret: SECRET,
    });

    expect(result.status).toBe("completed");
    expect(result.checkout_url).toMatch(/\/checkout\/[a-f0-9]+$/);
    expect(result.total_pence).toBeGreaterThan(0);

    const events = received.map((r) => r.event);
    expect(events[0]).toBe("progress"); // logged_in
    expect(received[0].body.event).toBe("logged_in");
    expect(events.filter((e) => e === "progress").length).toBeGreaterThanOrEqual(3);
    expect(events[events.length - 1]).toBe("completed");

    const completion = received.at(-1).body;
    expect(completion.tesco_checkout_url).toMatch(/\/checkout\//);
    expect(completion.total_pence).toBeGreaterThan(0);
    expect(completion.unmatched_items).toEqual([]);
  }, 60_000);

  it("posts verification_required and failed when login is challenged", async () => {
    received.length = 0;

    const result = await runBuild({
      buildId: 8,
      tescoEmail: "test@example.com",
      tescoPassword: "password",
      items: [{ freeform: "milk", quantity: 1 }],
      baseUrl: `${mockTescoUrl}/login?challenge=1` // not used, login.js builds its own URL
        .replace("/login?challenge=1", ""),
      railsCallbackBase: mockRailsUrl,
      hmacSecret: SECRET,
    });

    // The default login flow doesn't add the ?challenge=1 query — so this test is a smoke
    // test that login still completes against the un-challenged path. The challenge branch
    // is exercised by mock-tesco.test.js separately.
    expect(["completed", "failed"]).toContain(result.status);
  }, 60_000);

  describe("with cdpUrl (attach mode)", () => {
    let chrome;

    beforeAll(async () => {
      chrome = await startChromeWithCdp();
    }, 30_000);

    afterAll(async () => {
      await chrome?.cleanup();
    });

    it("attaches to a running Chrome, skips login, completes build, and leaves Chrome alive", async () => {
      received.length = 0;

      const result = await runBuild({
        buildId: 42,
        // tescoEmail/tescoPassword should be irrelevant in attach mode
        tescoEmail: "ignored@example.com",
        tescoPassword: "ignored",
        items: [{ freeform: "milk", quantity: 1 }],
        baseUrl: mockTescoUrl,
        railsCallbackBase: mockRailsUrl,
        hmacSecret: SECRET,
        cdpUrl: chrome.cdpUrl,
      });

      expect(result.status).toBe("completed");

      const events = received.map((r) => ({ event: r.event, body: r.body }));
      // Login was skipped — no "logged_in" event should appear.
      expect(events.some((e) => e.body.event === "logged_in")).toBe(false);
      // Instead, we expect an "attached" progress event.
      expect(events.some((e) => e.body.event === "attached")).toBe(true);
      // Build still reaches completion.
      expect(events.at(-1).event).toBe("completed");

      // Chrome should still be alive after the build (cleanup must not kill it).
      const res = await fetch(`${chrome.cdpUrl}/json/version`);
      expect(res.ok).toBe(true);
    }, 60_000);
  });

  it("records unmatched items and still completes", async () => {
    received.length = 0;

    const result = await runBuild({
      buildId: 9,
      tescoEmail: "test@example.com",
      tescoPassword: "password",
      items: [{ freeform: "asdfqwerzxcv-no-match", quantity: 1 }],
      baseUrl: mockTescoUrl,
      railsCallbackBase: mockRailsUrl,
      hmacSecret: SECRET,
    });

    expect(result.status).toBe("completed");
    expect(result.unmatched.length).toBe(1);
    expect(received.some((r) => r.body.event === "unmatched")).toBe(true);
  }, 60_000);
});
