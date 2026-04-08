export async function addToBasket(page, { baseUrl, productId, quantity }) {
  await page.goto(`${baseUrl}/product/${productId}`, { timeout: 10_000 });
  await page.fill("#quantity", String(quantity));
  await Promise.all([
    page.waitForLoadState("domcontentloaded", { timeout: 10_000 }),
    page.click("#add-to-basket"),
  ]);
  return { ok: true };
}
