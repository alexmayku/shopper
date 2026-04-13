// Check if a Tesco page navigation resulted in a login redirect,
// indicating the session has expired.
export function assertSessionAlive(page) {
  const url = page.url();
  if (url.includes("/account/login") || url.includes("/account/auth")) {
    throw new Error("session_expired");
  }
}
