import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServer } from "../src/server.js";
import { sign } from "../src/auth.js";

const SECRET = "test-secret";
let server;

beforeAll(async () => {
  server = buildServer({ secret: SECRET });
  await server.ready();
});

afterAll(async () => {
  await server.close();
});

describe("health", () => {
  it("returns ok", async () => {
    const res = await server.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });
});

describe("POST /build", () => {
  const payload = { buildId: 42, items: [{ freeform: "milk", quantity: 1 }] };
  const body = JSON.stringify(payload);

  it("accepts a request signed with the correct HMAC", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/build",
      headers: {
        "content-type": "application/json",
        "x-signature": sign(body, SECRET),
      },
      payload: body,
    });
    expect(res.statusCode).toBe(202);
    expect(res.json()).toEqual({ accepted: true });
  });

  it("rejects a request with an invalid signature", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/build",
      headers: {
        "content-type": "application/json",
        "x-signature": "deadbeef",
      },
      payload: body,
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects a request with no signature header", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/build",
      headers: { "content-type": "application/json" },
      payload: body,
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects a request signed with the wrong secret", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/build",
      headers: {
        "content-type": "application/json",
        "x-signature": sign(body, "wrong-secret"),
      },
      payload: body,
    });
    expect(res.statusCode).toBe(401);
  });
});
