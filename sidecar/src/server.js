import Fastify from "fastify";
import healthRoutes from "./routes/health.js";
import buildRoutes from "./routes/build.js";

export function buildServer({ secret = process.env.SIDECAR_HMAC_SECRET ?? "dev-secret" } = {}) {
  const fastify = Fastify({ logger: false });

  // Capture raw body so HMAC verification matches the exact bytes the client signed.
  fastify.addHook("preParsing", async (request, _reply, payload) => {
    let data = "";
    for await (const chunk of payload) data += chunk;
    request.rawBody = data;
    const stream = (await import("node:stream")).Readable.from(data);
    return stream;
  });

  fastify.register(healthRoutes);
  fastify.register(buildRoutes, { secret });

  return fastify;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 4001);
  const server = buildServer();
  server
    .listen({ host: "127.0.0.1", port })
    .then(() => console.log(`sidecar listening on http://127.0.0.1:${port}`))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
