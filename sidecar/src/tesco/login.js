export async function login(page, { baseUrl, email, password, loginPath = "/login" }) {
  await page.goto(`${baseUrl}${loginPath}`, { timeout: 10_000 });
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
