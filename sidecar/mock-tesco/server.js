import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyFormbody from "@fastify/formbody";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGES = path.join(__dirname, "pages");
const PRODUCTS = JSON.parse(fs.readFileSync(path.join(__dirname, "products.json"), "utf8"));

function tpl(name, vars) {
  let html = fs.readFileSync(path.join(PAGES, name), "utf8");
  for (const [k, v] of Object.entries(vars)) {
    html = html.replaceAll(`{{${k}}}`, v ?? "");
  }
  return html;
}

function findProduct(id) {
  return PRODUCTS.find((p) => p.id === id);
}

function searchProducts(q) {
  if (!q) return [];
  const needle = q.toLowerCase();
  return PRODUCTS.filter((p) => p.name.toLowerCase().includes(needle));
}

function basketTotal(basket) {
  return basket.items
    .reduce((sum, line) => sum + findProduct(line.product_id).price * line.quantity, 0)
    .toFixed(2);
}

export function buildMockTesco() {
  const fastify = Fastify({ logger: false });

  fastify.register(fastifyCookie);
  fastify.register(fastifyFormbody);

  // In-memory session store, keyed by the session cookie set on login.
  const sessions = new Map();
  // Items every new session is pre-seeded with. Set via /__test/preseed.
  const globalPreseed = [];

  function ensureSession(request, reply) {
    let sid = request.cookies?.mock_tesco_sid;
    if (!sid || !sessions.has(sid)) {
      sid = crypto.randomBytes(12).toString("hex");
      sessions.set(sid, {
        authed: false,
        basket: {
          id: crypto.randomBytes(6).toString("hex"),
          items: globalPreseed.map((line) => ({ ...line })),
        },
      });
      reply.setCookie("mock_tesco_sid", sid, { path: "/", httpOnly: true });
    }
    return sessions.get(sid);
  }

  fastify.post("/__test/preseed", async (request, reply) => {
    const { items = [] } = request.body ?? {};
    globalPreseed.length = 0;
    for (const item of items) globalPreseed.push(item);
    return reply.send({ ok: true, preseed: globalPreseed });
  });

  fastify.post("/__test/reset", async (_req, reply) => {
    globalPreseed.length = 0;
    sessions.clear();
    return reply.send({ ok: true });
  });

  fastify.get("/", async (request, reply) => {
    ensureSession(request, reply);
    reply.type("text/html").send("<!doctype html><html><body><h1>Mock Tesco</h1><p>Homepage.</p></body></html>");
  });

  fastify.get("/login", async (request, reply) => {
    ensureSession(request, reply);
    const challenge = request.query?.challenge === "1";
    reply
      .type("text/html")
      .send(
        tpl("login.html", {
          CHALLENGE_BANNER: challenge
            ? '<p data-challenge>Verify your identity to continue.</p>'
            : "",
          CHALLENGE_QS: challenge ? "?challenge=1" : "",
        })
      );
  });

  fastify.post("/login", async (request, reply) => {
    const session = ensureSession(request, reply);
    if (request.query?.challenge === "1") {
      reply
        .type("text/html")
        .send(
          '<!doctype html><html><body><h1>Mock Tesco</h1><div data-verify-required>Please verify your identity to continue.</div></body></html>'
        );
      return;
    }
    session.authed = true;
    reply.redirect("/");
  });

  fastify.get("/search", async (request, reply) => {
    ensureSession(request, reply);
    const q = (request.query?.q ?? "").toString();
    const results = searchProducts(q)
      .map(
        (p) =>
          `<li data-product data-product-id="${p.id}"><a href="/product/${p.id}">${p.name}</a> <span data-price>£${p.price.toFixed(2)}</span></li>`
      )
      .join("\n");
    reply.type("text/html").send(tpl("search.html", { QUERY: q, RESULTS: results }));
  });

  fastify.get("/product/:id", async (request, reply) => {
    ensureSession(request, reply);
    const p = findProduct(request.params.id);
    if (!p) return reply.code(404).send("Not found");
    reply.type("text/html").send(
      tpl("product.html", {
        ID: p.id,
        NAME: p.name,
        PRICE: p.price.toFixed(2),
        CATEGORY: p.category,
      })
    );
  });

  fastify.post("/basket/add", async (request, reply) => {
    const session = ensureSession(request, reply);
    const { product_id, quantity } = request.body ?? {};
    if (!findProduct(product_id)) return reply.code(404).send("Unknown product");
    const qty = Math.max(1, parseInt(quantity ?? "1", 10));
    const existing = session.basket.items.find((i) => i.product_id === product_id);
    if (existing) existing.quantity += qty;
    else session.basket.items.push({ product_id, quantity: qty });
    reply.redirect("/basket");
  });

  // Test helper: pre-populate the basket with one item before login.
  fastify.post("/__test/seed_basket", async (request, reply) => {
    const session = ensureSession(request, reply);
    const { product_id = "p001", quantity = 1 } = request.body ?? {};
    if (!findProduct(product_id)) return reply.code(404).send("Unknown product");
    session.basket.items.push({ product_id, quantity: parseInt(quantity, 10) });
    return reply.send({ ok: true });
  });

  fastify.get("/basket/clear", async (request, reply) => {
    const session = ensureSession(request, reply);
    session.basket.items = [];
    reply.redirect("/basket");
  });

  fastify.get("/basket", async (request, reply) => {
    const session = ensureSession(request, reply);
    const items = session.basket.items
      .map((line) => {
        const p = findProduct(line.product_id);
        return `<li data-line data-product-id="${p.id}">${p.name} × ${line.quantity} — £${(p.price * line.quantity).toFixed(2)}</li>`;
      })
      .join("\n");
    reply.type("text/html").send(
      tpl("basket.html", { ITEMS: items, TOTAL: basketTotal(session.basket) })
    );
  });

  fastify.post("/checkout", async (request, reply) => {
    const session = ensureSession(request, reply);
    reply.redirect(`/checkout/${session.basket.id}`);
  });

  fastify.get("/checkout/:basket_id", async (request, reply) => {
    const session = ensureSession(request, reply);
    reply.type("text/html").send(
      tpl("checkout.html", {
        BASKET_ID: request.params.basket_id,
        TOTAL: basketTotal(session.basket),
      })
    );
  });

  return fastify;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.MOCK_TESCO_PORT ?? 4002);
  buildMockTesco()
    .listen({ host: "127.0.0.1", port })
    .then(() => console.log(`mock-tesco listening on http://127.0.0.1:${port}`))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
