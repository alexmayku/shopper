import { assertSessionAlive } from "./session-check.js";

export async function addToBasket(page, { baseUrl, productId, quantity }) {
  const url = `${baseUrl}/groceries/en-GB/products/${productId}`;

  // Navigate with a timeout. If goto hangs (common on Tesco OOS pages), we
  // catch the timeout and check whether the add button appeared anyway.
  try {
    await page.goto(url, { timeout: 15_000 });
    assertSessionAlive(page);
  } catch (e) {
    if (e.message === "session_expired") throw e;
    // goto timed out — page may have partially loaded. Check for add button below.
  }

  // Wait up to 5s for either the add button or the "Rest of shelf" link
  // (which Tesco shows on OOS pages instead of an add button).
  const addBtn = page.locator('[data-auto="ddsweb-quantity-controls-add-button"]');
  try {
    await addBtn.waitFor({ state: "visible", timeout: 5_000 });
  } catch {
    console.log(`[add_to_basket] No add button found for product ${productId} — out of stock`);
    return { ok: false, reason: "out_of_stock" };
  }

  const qtyInput = page.locator('[data-auto="ddsweb-quantity-controls-input"]');
  await qtyInput.fill(String(quantity));
  await addBtn.click();
  await page.waitForTimeout(1_000);
  return { ok: true };
}
