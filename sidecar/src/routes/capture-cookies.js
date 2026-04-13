import { verify } from "../auth.js";
import { attachBrowser } from "../tesco/browser.js";

export default async function captureCookiesRoutes(fastify, opts) {
  const secret = opts.secret;

  function checkSig(request, reply) {
    const signature = request.headers["x-signature"];
    const raw = request.rawBody ?? JSON.stringify(request.body ?? {});
    if (!verify(raw, signature, secret)) {
      reply.code(401).send({ error: "invalid signature" });
      return false;
    }
    return true;
  }

  // Connect to a running CDP Chrome, capture its storageState (cookies +
  // localStorage), and return it. The Chrome process is NOT terminated.
  fastify.post("/capture-cookies", async (request, reply) => {
    if (!checkSig(request, reply)) return;
    const { cdpUrl } = request.body ?? {};
    if (!cdpUrl) return reply.code(400).send({ error: "cdpUrl required" });

    try {
      const handle = await attachBrowser({ cdpUrl });
      const storageState = await handle.context.storageState();
      await handle.cleanup();
      return reply.send({ storageState });
    } catch (e) {
      return reply.code(500).send({ error: e.message });
    }
  });
}
