export async function login(page, { baseUrl, email, password }) {
  await page.goto(`${baseUrl}/login`, { timeout: 10_000 });
  await page.fill("#email", email);
  await page.fill("#password", password);
  await Promise.all([
    page.waitForLoadState("domcontentloaded", { timeout: 10_000 }),
    page.click("#signin"),
  ]);

  // Detect verification challenge.
  if (await page.locator("[data-verify-required]").count() > 0) {
    return { ok: false, reason: "verification_required" };
  }
  return { ok: true };
}
