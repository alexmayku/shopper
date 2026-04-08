export async function goToCheckout(page, { baseUrl }) {
  await page.goto(`${baseUrl}/basket`, { timeout: 10_000 });
  const totalText = (await page.textContent("[data-basket-total]")) ?? "0";
  const total_pence = Math.round(parseFloat(totalText) * 100);
  await Promise.all([
    page.waitForLoadState("domcontentloaded", { timeout: 10_000 }),
    page.click("#go-to-checkout"),
  ]);
  const checkout_url = page.url();
  return { checkout_url, total_pence };
}
