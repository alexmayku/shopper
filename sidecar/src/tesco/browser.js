import { chromium as baseChromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

baseChromium.use(StealthPlugin());

export async function launchBrowser({ proxy, storageState, headless = false } = {}) {
  const launchOpts = { headless };
  if (proxy?.server) launchOpts.proxy = proxy;
  const browser = await baseChromium.launch(launchOpts);
  const contextOpts = storageState ? { storageState } : {};
  const context = await browser.newContext(contextOpts);
  return {
    browser,
    context,
    attached: false,
    cleanup: async () => {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
    },
  };
}

// Attach to a Chrome already running with --remote-debugging-port=N. The user
// is expected to have logged into Tesco manually in that browser; we reuse
// their existing context (and cookies) instead of launching a fresh Chromium
// that anti-bot defenses can fingerprint.
export async function attachBrowser({ cdpUrl }) {
  const browser = await baseChromium.connectOverCDP(cdpUrl);
  const contexts = browser.contexts();
  const context = contexts[0] ?? (await browser.newContext());
  return {
    browser,
    context,
    attached: true,
    cleanup: async () => {
      // For a CDP-connected browser, browser.close() disconnects the
      // WebSocket without terminating the underlying Chrome process.
      await browser.close().catch(() => {});
    },
  };
}
