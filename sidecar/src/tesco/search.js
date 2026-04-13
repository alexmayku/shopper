import { assertSessionAlive } from "./session-check.js";

export async function search(page, { baseUrl, query, limit = 5 }) {
  await page.goto(`${baseUrl}/groceries/en-GB/search?query=${encodeURIComponent(query)}`, { timeout: 10_000 });
  assertSessionAlive(page);
  const results = await page.$$eval("li[data-testid]", (els, max) => {
    return els.slice(0, max).map((el) => {
      const link = el.querySelector("a[class*='titleLink']") ?? el.querySelector("a");
      const href = link?.getAttribute("href") ?? "";
      const idMatch = href.match(/\/products\/([^?/]+)/);
      return {
        tesco_product_id: idMatch ? idMatch[1] : el.getAttribute("data-testid"),
        name: link?.textContent?.trim(),
        price_text: el.querySelector("p[class*='priceText']")?.textContent?.trim(),
      };
    });
  }, limit);
  return results;
}
