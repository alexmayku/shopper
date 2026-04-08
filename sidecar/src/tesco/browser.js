import { chromium as baseChromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

baseChromium.use(StealthPlugin());

export async function launchBrowser({ proxy } = {}) {
  const launchOpts = { headless: true };
  if (proxy?.server) launchOpts.proxy = proxy;
  const browser = await baseChromium.launch(launchOpts);
  const context = await browser.newContext();
  return { browser, context };
}
