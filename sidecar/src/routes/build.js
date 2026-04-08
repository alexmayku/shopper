import { verify } from "../auth.js";
import { runBuild } from "../build-runner.js";

export default async function buildRoutes(fastify, opts) {
  const secret = opts.secret;

  fastify.post("/build", async (request, reply) => {
    const signature = request.headers["x-signature"];
    const raw = request.rawBody ?? JSON.stringify(request.body ?? {});
    if (!verify(raw, signature, secret)) {
      return reply.code(401).send({ error: "invalid signature" });
    }

    const payload = request.body ?? {};
    // Fire-and-forget: build runs in the background, progress comes back via callbacks.
    runBuild({
      buildId: payload.buildId,
      tescoEmail: payload.tescoEmail,
      tescoPassword: payload.tescoPassword,
      items: payload.items ?? [],
      railsCallbackBase: payload.railsCallbackBase,
      hmacSecret: secret,
    }).catch((err) => fastify.log?.error?.(err));

    return reply.code(202).send({ accepted: true, buildId: payload.buildId });
  });
}
