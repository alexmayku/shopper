import { sign } from "../auth.js";

export function makeCacheClient({ railsCallbackBase, hmacSecret, fetchFn = fetch }) {
  async function get({ userId, freeformText }) {
    const url = `${railsCallbackBase}/internal/users/${userId}/product_matches?freeform_text=${encodeURIComponent(freeformText)}`;
    const sig = sign("", hmacSecret);
    const res = await fetchFn(url, { headers: { "x-signature": sig } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`cache get ${res.status}`);
    return await res.json();
  }

  async function put({ userId, match }) {
    const url = `${railsCallbackBase}/internal/users/${userId}/product_matches`;
    const body = JSON.stringify(match);
    const res = await fetchFn(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-signature": sign(body, hmacSecret) },
      body,
    });
    if (!res.ok) throw new Error(`cache put ${res.status}`);
    return await res.json();
  }

  return { get, put };
}
