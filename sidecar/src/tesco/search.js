export async function search(page, { baseUrl, query, limit = 5 }) {
  await page.goto(`${baseUrl}/search?q=${encodeURIComponent(query)}`, { timeout: 10_000 });
  const results = await page.$$eval("[data-product]", (els, max) => {
    return els.slice(0, max).map((el) => ({
      tesco_product_id: el.getAttribute("data-product-id"),
      name: el.querySelector("a")?.textContent?.trim(),
      price_text: el.querySelector("[data-price]")?.textContent?.trim(),
    }));
  }, limit);
  return results;
}
