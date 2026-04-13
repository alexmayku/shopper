import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServer } from "../src/server.js";
import { buildMockTesco } from "../mock-tesco/server.js";
import { sign } from "../src/auth.js";
import { startChromeWithCdp } from "./helpers/chrome-cdp.js";
import { chromium } from "playwright";

const SECRET = "test-secret";
let server, mockTesco, chrome;

beforeAll(async () => {
  mockTesco = buildMockTesco();
  await mockTesco.listen({ host: "127.0.0.1", port: 0 });

  server = buildServer({ secret: SECRET });
  await server.ready();

  chrome = await startChromeWithCdp();

  // Log into mock Tesco in the CDP Chrome so it has session cookies.
  const browser = await chromium.connectOverCDP(chrome.cdpUrl);
  const context = browser.contexts()[0] ?? (await browser.newContext());
  const page = await context.newPage();
  const mockUrl = `http://127.0.0.1:${mockTesco.server.address().port}`;
  await page.goto(`${mockUrl}/login`);
  await page.fill("#email", "test@example.com");
  await page.fill("#password", "password");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/");
  await page.close();
  await browser.close();
}, 30_000);

afterAll(async () => {
  await server?.close();
  await mockTesco?.close();
  await chrome?.cleanup();
});

describe("POST /capture-cookies", () => {
  it("connects to CDP Chrome and returns storageState with cookies", async () => {
    const body = JSON.stringify({ cdpUrl: chrome.cdpUrl });
    const res = await server.inject({
      method: "POST",
      url: "/capture-cookies",
      headers: { "content-type": "application/json", "x-signature": sign(body, SECRET) },
      payload: body,
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.storageState).toBeTruthy();
    expect(json.storageState.cookies).toBeTruthy();
    expect(Array.isArray(json.storageState.cookies)).toBe(true);
    expect(json.storageState.cookies.length).toBeGreaterThan(0);
  }, 15_000);

  it("rejects unsigned requests", async () => {
    const body = JSON.stringify({ cdpUrl: chrome.cdpUrl });
    const res = await server.inject({
      method: "POST",
      url: "/capture-cookies",
      headers: { "content-type": "application/json", "x-signature": "bad" },
      payload: body,
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 500 for unreachable CDP URL", async () => {
    const body = JSON.stringify({ cdpUrl: "http://127.0.0.1:1" });
    const res = await server.inject({
      method: "POST",
      url: "/capture-cookies",
      headers: { "content-type": "application/json", "x-signature": sign(body, SECRET) },
      payload: body,
    });
    expect(res.statusCode).toBe(500);
  }, 15_000);
});
