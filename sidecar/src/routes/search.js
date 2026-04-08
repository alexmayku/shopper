import { verify } from "../auth.js";
import { launchBrowser } from "../tesco/browser.js";
import { search as tescoSearch } from "../tesco/search.js";

export default async function searchRoutes(fastify, opts) {
  const secret = opts.secret;
  const baseUrl = process.env.TESCO_BASE_URL ?? "http://localhost:4002";

  fastify.post("/search", async (request, reply) => {
    const sig = request.headers["x-signature"];
    const raw = request.rawBody ?? JSON.stringify(request.body ?? {});
    if (!verify(raw, sig, secret)) return reply.code(401).send({ error: "invalid signature" });

    const { query, limit = 5 } = request.body ?? {};
    if (!query) return reply.code(400).send({ error: "query required" });

    const { browser, context } = await launchBrowser({});
    try {
      const page = await context.newPage();
      const results = await tescoSearch(page, { baseUrl, query, limit });
      return reply.send({ results });
    } finally {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
    }
  });
}
