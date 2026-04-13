import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildMockTesco } from "../mock-tesco/server.js";

let server;

beforeAll(async () => {
  server = buildMockTesco();
  await server.ready();
});

afterAll(async () => {
  await server.close();
});

function getCookie(res) {
  const sc = res.headers["set-cookie"];
  if (!sc) return null;
  const arr = Array.isArray(sc) ? sc : [sc];
  const found = arr.find((c) => c.startsWith("mock_tesco_sid="));
  return found ? found.split(";")[0] : null;
}

describe("mock tesco", () => {
  it("login page renders", async () => {
    const res = await server.inject({ method: "GET", url: "/login" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("Sign in");
    expect(res.body).toContain('id="email"');
  });

  it("login with any credentials redirects to homepage", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/login",
      payload: "email=a@b.com&password=anything",
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/");
  });

  it("?challenge=1 shows verify-your-identity interstitial", async () => {
    const get = await server.inject({ method: "GET", url: "/login?challenge=1" });
    expect(get.body).toContain("Verify your identity");

    const post = await server.inject({
      method: "POST",
      url: "/login?challenge=1",
      payload: "email=a@b.com&password=x",
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });
    expect(post.body).toContain("data-verify-required");
  });

  it("search returns matching products", async () => {
    const res = await server.inject({ method: "GET", url: "/groceries/en-GB/search?query=milk" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("Whole Milk");
    expect(res.body).toContain("data-testid=");
  });

  it("search with no matches returns an empty list", async () => {
    const res = await server.inject({ method: "GET", url: "/groceries/en-GB/search?query=zzznotreal" });
    expect(res.statusCode).toBe(200);
    expect(res.body).not.toContain("data-testid=");
  });

  it("can add a product to the basket and see it on /groceries/ with a total", async () => {
    const initial = await server.inject({ method: "GET", url: "/" });
    const cookie = getCookie(initial);
    expect(cookie).toBeTruthy();

    const add = await server.inject({
      method: "POST",
      url: "/groceries/en-GB/trolley/add",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie,
      },
      payload: "product_id=p001&quantity=2",
    });
    expect(add.statusCode).toBe(302);
    expect(add.headers.location).toBe("/groceries/");

    const basket = await server.inject({
      method: "GET",
      url: "/groceries/",
      headers: { cookie },
    });
    expect(basket.statusCode).toBe(200);
    expect(basket.body).toContain("Whole Milk");
    // £1.85 × 2 = 3.70
    expect(basket.body).toContain("data-basket-total>3.70");
  });

  it("checkout returns a stable per-session basket URL", async () => {
    const initial = await server.inject({ method: "GET", url: "/" });
    const cookie = getCookie(initial);

    await server.inject({
      method: "POST",
      url: "/groceries/en-GB/trolley/add",
      headers: { "content-type": "application/x-www-form-urlencoded", cookie },
      payload: "product_id=p101&quantity=1",
    });

    const checkout = await server.inject({
      method: "POST",
      url: "/groceries/en-GB/checkout",
      headers: { cookie },
    });
    expect(checkout.statusCode).toBe(302);
    expect(checkout.headers.location).toMatch(/^\/groceries\/en-GB\/checkout\/[a-f0-9]+$/);

    const page = await server.inject({
      method: "GET",
      url: checkout.headers.location,
      headers: { cookie },
    });
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain("Checkout");
    expect(page.body).toContain("data-checkout-total>0.85");
  });
});
