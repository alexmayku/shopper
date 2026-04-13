export async function login(page, { baseUrl, email, password, loginPath = "/login" }) {
  await page.goto(`${baseUrl}${loginPath}`, { timeout: 30_000, waitUntil: "domcontentloaded" });

  // Dismiss cookie banner if present (real Tesco shows one on first visit).
  const rejectBtn = page.getByRole("button", { name: /reject all/i }).first();
  if (await rejectBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await rejectBtn.click().catch(() => {});
  }

  await page.fill("#email", email);

  // Two-step login: if #password isn't on this page, advance first.
  const passwordHere = await page.locator("#password").isVisible().catch(() => false);
  if (!passwordHere) {
    await page.getByRole("button", { name: /continue|next|sign in/i }).first().click();
    await page.waitForSelector("#password", { timeout: 15_000 });
  }

  await page.fill("#password", password);
  await Promise.all([
    page.waitForLoadState("domcontentloaded", { timeout: 15_000 }),
    page.getByRole("button", { name: /sign in/i }).first().click(),
  ]);

  // Detect verification challenge.
  if (await page.locator("[data-verify-required]").count() > 0) {
    return { ok: false, reason: "verification_required" };
  }
  return { ok: true };
}
