import { verify } from "../auth.js";
import { runBuild, resolveExistingBasketDecision } from "../build-runner.js";

export default async function buildRoutes(fastify, opts) {
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

  fastify.post("/build", async (request, reply) => {
    if (!checkSig(request, reply)) return;
    const payload = request.body ?? {};
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

  fastify.post("/build/:id/resume", async (request, reply) => {
    if (!checkSig(request, reply)) return;
    const action = (request.body ?? {}).action;
    if (!["replace", "merge", "cancel"].includes(action)) {
      return reply.code(400).send({ error: "invalid action" });
    }
    const ok = resolveExistingBasketDecision(Number(request.params.id), action);
    if (!ok) return reply.code(404).send({ error: "no_pending_decision" });
    return reply.code(202).send({ accepted: true });
  });
}
