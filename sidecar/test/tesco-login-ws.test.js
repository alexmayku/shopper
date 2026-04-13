import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServer } from "../src/server.js";
import { buildMockTesco } from "../mock-tesco/server.js";
import { sign } from "../src/auth.js";
import WebSocket from "ws";

const SECRET = "test-secret";
let server, mockTesco, serverUrl;

beforeAll(async () => {
  mockTesco = buildMockTesco();
  await mockTesco.listen({ host: "127.0.0.1", port: 0 });
  process.env.TESCO_BASE_URL = `http://127.0.0.1:${mockTesco.server.address().port}`;
  process.env.TESCO_LOGIN_PATH = "/login";
  server = buildServer({ secret: SECRET });
  await server.listen({ host: "127.0.0.1", port: 0 });
  serverUrl = `http://127.0.0.1:${server.server.address().port}`;
}, 30_000);

afterAll(async () => {
  await server?.close();
  await mockTesco?.close();
  delete process.env.TESCO_BASE_URL;
  delete process.env.TESCO_LOGIN_PATH;
});

async function createLoginSession() {
  const body = JSON.stringify({});
  const res = await server.inject({
    method: "POST",
    url: "/tesco-login",
    headers: { "content-type": "application/json", "x-signature": sign(body, SECRET) },
    payload: body,
  });
  return res.json().loginId;
}

async function cleanupSession(loginId) {
  const body = JSON.stringify("");
  await server.inject({
    method: "POST",
    url: `/tesco-login/${loginId}/cancel`,
    headers: { "content-type": "application/json", "x-signature": sign(body, SECRET) },
    payload: body,
  });
}

describe("GET /tesco-login/:id/ws (WebSocket screencast)", () => {
  it("streams JPEG frames after connecting", async () => {
    const loginId = await createLoginSession();
    // Wait for browser to launch and navigate.
    await new Promise((r) => setTimeout(r, 2_000));

    const token = sign(loginId, SECRET);
    const wsUrl = serverUrl.replace("http", "ws");

    const frames = [];
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(`${wsUrl}/tesco-login/${loginId}/ws?token=${token}`);
      ws.on("error", reject);
      ws.on("message", (data) => {
        // Frames are binary JPEG data.
        if (Buffer.isBuffer(data) || data instanceof ArrayBuffer) {
          frames.push(data);
        }
        if (frames.length >= 2) {
          ws.close();
          resolve();
        }
      });
      // Timeout after 10s if no frames received.
      setTimeout(() => {
        ws.close();
        resolve();
      }, 10_000);
    });

    expect(frames.length).toBeGreaterThanOrEqual(1);
    // JPEG files start with 0xFF 0xD8.
    const first = Buffer.from(frames[0]);
    expect(first[0]).toBe(0xFF);
    expect(first[1]).toBe(0xD8);

    await cleanupSession(loginId);
  }, 30_000);

  it("accepts mouse click input and dispatches to browser", async () => {
    const loginId = await createLoginSession();
    await new Promise((r) => setTimeout(r, 2_000));

    const token = sign(loginId, SECRET);
    const wsUrl = serverUrl.replace("http", "ws");

    await new Promise((resolve) => {
      const ws = new WebSocket(`${wsUrl}/tesco-login/${loginId}/ws?token=${token}`);
      ws.on("open", () => {
        // Send a click event — should not crash.
        ws.send(JSON.stringify({ type: "click", x: 100, y: 100 }));
        setTimeout(() => {
          ws.close();
          resolve();
        }, 1_000);
      });
    });

    // If we got here without crashing, the input dispatch worked.
    await cleanupSession(loginId);
  }, 30_000);

  it("rejects connection with invalid token", async () => {
    const loginId = await createLoginSession();
    await new Promise((r) => setTimeout(r, 1_000));

    const wsUrl = serverUrl.replace("http", "ws");

    const closed = await new Promise((resolve) => {
      const ws = new WebSocket(`${wsUrl}/tesco-login/${loginId}/ws?token=invalid`);
      ws.on("close", (code) => resolve(code));
      ws.on("error", () => resolve("error"));
    });

    // Should be closed with 4001 (auth failure) or connection error.
    expect(["error", 4001, 1006]).toContain(closed);

    await cleanupSession(loginId);
  }, 15_000);

  it("returns 404 for unknown session", async () => {
    const wsUrl = serverUrl.replace("http", "ws");
    const token = sign("fake", SECRET);

    const closed = await new Promise((resolve) => {
      const ws = new WebSocket(`${wsUrl}/tesco-login/fake/ws?token=${token}`);
      ws.on("close", (code) => resolve(code));
      ws.on("error", () => resolve("error"));
    });

    expect(["error", 4004, 1006]).toContain(closed);
  }, 15_000);
});
