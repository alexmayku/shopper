import { sign } from "./auth.js";

export async function postToRails({ url, secret, body }) {
  const json = JSON.stringify(body);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-signature": sign(json, secret),
    },
    body: json,
  });
  return { ok: res.ok, status: res.status };
}
