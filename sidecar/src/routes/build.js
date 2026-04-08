import { verify } from "../auth.js";

export default async function buildRoutes(fastify, opts) {
  const secret = opts.secret;

  fastify.post("/build", async (request, reply) => {
    const signature = request.headers["x-signature"];
    const raw = request.rawBody ?? JSON.stringify(request.body ?? {});
    if (!verify(raw, signature, secret)) {
      return reply.code(401).send({ error: "invalid signature" });
    }
    return reply.code(202).send({ accepted: true });
  });
}
