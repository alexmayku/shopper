import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServer } from "../src/server.js";
import { buildMockTesco } from "../mock-tesco/server.js";
import { sign } from "../src/auth.js";

const SECRET = "test-secret";
let server, mockTesco;

beforeAll(async () => {
  mockTesco = buildMockTesco();
  await mockTesco.listen({ host: "127.0.0.1", port: 0 });
  process.env.TESCO_BASE_URL = `http://127.0.0.1:${mockTesco.server.address().port}`;
  server = buildServer({ secret: SECRET });
  await server.ready();
}, 30_000);

afterAll(async () => {
  await server?.close();
  await mockTesco?.close();
  delete process.env.TESCO_BASE_URL;
});

describe("POST /search", () => {
  it("returns matching tesco products for a query", async () => {
    const body = JSON.stringify({ query: "milk" });
    const res = await server.inject({
      method: "POST",
      url: "/search",
      headers: { "content-type": "application/json", "x-signature": sign(body, SECRET) },
      payload: body,
    });
    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(Array.isArray(json.results)).toBe(true);
    expect(json.results.length).toBeGreaterThan(0);
    expect(json.results[0]).toHaveProperty("tesco_product_id");
  }, 60_000);

  it("rejects an unsigned request", async () => {
    const body = JSON.stringify({ query: "milk" });
    const res = await server.inject({
      method: "POST",
      url: "/search",
      headers: { "content-type": "application/json", "x-signature": "deadbeef" },
      payload: body,
    });
    expect(res.statusCode).toBe(401);
  });

  it("400s without a query", async () => {
    const body = JSON.stringify({});
    const res = await server.inject({
      method: "POST",
      url: "/search",
      headers: { "content-type": "application/json", "x-signature": sign(body, SECRET) },
      payload: body,
    });
    expect(res.statusCode).toBe(400);
  });
});
