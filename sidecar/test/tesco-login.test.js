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
  process.env.TESCO_LOGIN_PATH = "/login";
  server = buildServer({ secret: SECRET });
  await server.ready();
}, 30_000);

afterAll(async () => {
  await server?.close();
  await mockTesco?.close();
  delete process.env.TESCO_BASE_URL;
  delete process.env.TESCO_LOGIN_PATH;
});

describe("POST /tesco-login", () => {
  it("starts a login session and returns a loginId", async () => {
    const body = JSON.stringify({});
    const res = await server.inject({
      method: "POST",
      url: "/tesco-login",
      headers: { "content-type": "application/json", "x-signature": sign(body, SECRET) },
      payload: body,
    });
    expect(res.statusCode).toBe(202);
    const json = res.json();
    expect(json.loginId).toBeTruthy();
    expect(typeof json.loginId).toBe("string");

    // Wait briefly for login to complete in background, then clean up.
    await new Promise((r) => setTimeout(r, 3_000));

    // Complete to clean up the browser.
    const completeBody = JSON.stringify("");
    const complete = await server.inject({
      method: "POST",
      url: `/tesco-login/${json.loginId}/complete`,
      headers: { "content-type": "application/json", "x-signature": sign(completeBody, SECRET) },
      payload: completeBody,
    });
    expect(complete.statusCode).toBe(200);
    expect(complete.json().storageState).toBeTruthy();
  }, 30_000);

  it("rejects unsigned requests", async () => {
    const body = JSON.stringify({});
    const res = await server.inject({
      method: "POST",
      url: "/tesco-login",
      headers: { "content-type": "application/json", "x-signature": "bad" },
      payload: body,
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("GET /tesco-login/:id/status", () => {
  it("returns 404 for unknown session", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/tesco-login/nonexistent/status",
      headers: { "x-signature": sign("", SECRET) },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns current status of a login session", async () => {
    const body = JSON.stringify({});
    const createRes = await server.inject({
      method: "POST",
      url: "/tesco-login",
      headers: { "content-type": "application/json", "x-signature": sign(body, SECRET) },
      payload: body,
    });
    const { loginId } = createRes.json();

    const statusRes = await server.inject({
      method: "GET",
      url: `/tesco-login/${loginId}/status`,
      headers: { "x-signature": sign("", SECRET) },
    });
    expect(statusRes.statusCode).toBe(200);
    expect(statusRes.json().status).toBe("awaiting_login");

    // Clean up.
    const completeBody = JSON.stringify("");
    await server.inject({
      method: "POST",
      url: `/tesco-login/${loginId}/complete`,
      headers: { "content-type": "application/json", "x-signature": sign(completeBody, SECRET) },
      payload: completeBody,
    });
  }, 30_000);
});

describe("POST /tesco-login/:id/cancel", () => {
  it("cleans up the session", async () => {
    const body = JSON.stringify({});
    const createRes = await server.inject({
      method: "POST",
      url: "/tesco-login",
      headers: { "content-type": "application/json", "x-signature": sign(body, SECRET) },
      payload: body,
    });
    const { loginId } = createRes.json();

    await new Promise((r) => setTimeout(r, 1_000));

    const cancelBody = JSON.stringify("");
    const cancelRes = await server.inject({
      method: "POST",
      url: `/tesco-login/${loginId}/cancel`,
      headers: { "content-type": "application/json", "x-signature": sign(cancelBody, SECRET) },
      payload: cancelBody,
    });
    expect(cancelRes.statusCode).toBe(200);

    // After cancel, status should 404.
    const statusRes = await server.inject({
      method: "GET",
      url: `/tesco-login/${loginId}/status`,
      headers: { "x-signature": sign("", SECRET) },
    });
    expect(statusRes.statusCode).toBe(404);
  }, 30_000);
});

describe("POST /tesco-login/:id/complete", () => {
  it("returns storageState with cookies after successful login", async () => {
    const body = JSON.stringify({});
    const createRes = await server.inject({
      method: "POST",
      url: "/tesco-login",
      headers: { "content-type": "application/json", "x-signature": sign(body, SECRET) },
      payload: body,
    });
    const { loginId } = createRes.json();

    // Wait for login to complete.
    await new Promise((r) => setTimeout(r, 3_000));

    const completeBody = JSON.stringify("");
    const res = await server.inject({
      method: "POST",
      url: `/tesco-login/${loginId}/complete`,
      headers: { "content-type": "application/json", "x-signature": sign(completeBody, SECRET) },
      payload: completeBody,
    });
    expect(res.statusCode).toBe(200);
    const { storageState } = res.json();
    expect(storageState).toBeTruthy();
    expect(storageState.cookies).toBeTruthy();
    expect(Array.isArray(storageState.cookies)).toBe(true);
    expect(storageState.cookies.length).toBeGreaterThan(0);
  }, 30_000);
});
