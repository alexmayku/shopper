import { assertSessionAlive } from "./session-check.js";

export async function goToCheckout(page, { baseUrl }) {
  await page.goto(`${baseUrl}/groceries/`, { timeout: 30_000 });
  assertSessionAlive(page);

  // Extract total — try real Tesco's price selector, fall back to mock's data attribute.
  let totalText = "0";
  const realTotal = page.locator('[data-auto="price-value"]');
  const mockTotal = page.locator("[data-basket-total]");
  if (await realTotal.count() > 0) {
    totalText = (await realTotal.first().textContent()) ?? "0";
  } else if (await mockTotal.count() > 0) {
    totalText = (await mockTotal.textContent()) ?? "0";
  }
  const total_pence = Math.round(parseFloat(totalText.replace(/[^0-9.]/g, "")) * 100);

  // Click checkout — try real Tesco's button, fall back to mock's.
  const realCheckout = page.locator('a:has-text("Checkout"), button:has-text("Checkout")').first();
  const mockCheckout = page.locator("#go-to-checkout");
  const checkoutBtn = (await realCheckout.count() > 0) ? realCheckout : mockCheckout;
  await Promise.all([
    page.waitForLoadState("domcontentloaded", { timeout: 10_000 }),
    checkoutBtn.click(),
  ]);
  const checkout_url = page.url();
  return { checkout_url, total_pence };
}
