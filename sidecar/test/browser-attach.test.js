import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { attachBrowser } from "../src/tesco/browser.js";
import { startChromeWithCdp } from "./helpers/chrome-cdp.js";

let chrome;

beforeAll(async () => {
  chrome = await startChromeWithCdp();
}, 30_000);

afterAll(async () => {
  await chrome?.cleanup();
});

describe("attachBrowser", () => {
  it("connects to a running Chrome over CDP and returns a usable context", async () => {
    const { browser, context, attached, cleanup } = await attachBrowser({ cdpUrl: chrome.cdpUrl });

    expect(attached).toBe(true);
    expect(browser).toBeDefined();
    expect(context).toBeDefined();
    expect(typeof cleanup).toBe("function");

    const page = await context.newPage();
    await page.goto("data:text/html,<h1>hello</h1>");
    expect(await page.locator("h1").textContent()).toBe("hello");
    await page.close();

    await cleanup();
  }, 30_000);

  it("does not kill the underlying Chrome process when cleanup() runs", async () => {
    const { cleanup } = await attachBrowser({ cdpUrl: chrome.cdpUrl });
    await cleanup();

    // Chrome's CDP /json/version endpoint should still respond after the
    // sidecar disconnects — proving we did not close the user's browser.
    const res = await fetch(`${chrome.cdpUrl}/json/version`);
    expect(res.ok).toBe(true);
  }, 30_000);
});
