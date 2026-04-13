export async function checkExistingBasket(page, { baseUrl }) {
  await page.goto(`${baseUrl}/groceries/`, { timeout: 10_000 });
  const itemCount = await page.$$eval("[data-line]", (els) => els.length);
  return { itemCount };
}

export async function emptyBasket(page, { baseUrl }) {
  // Mock Tesco offers /basket/clear; real Tesco needs per-line removes.
  await page.goto(`${baseUrl}/groceries/en-GB/trolley/clear`, { timeout: 10_000 });
}
