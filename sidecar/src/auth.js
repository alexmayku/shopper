import crypto from "node:crypto";

export function sign(body, secret) {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

export function verify(body, signature, secret) {
  if (!signature || typeof signature !== "string") return false;
  const expected = sign(body, secret);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
