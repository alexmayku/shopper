import { verify } from "../auth.js";
import { runBuild, resolveExistingBasketDecision } from "../build-runner.js";
import { makeCachedMatcher } from "../matching/match.js";
import { callClaude } from "../matching/anthropic-client.js";
import { makeCacheClient } from "../matching/cache-client.js";

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
    const proxy = process.env.PROXY_PROVIDER_HOST
      ? {
          server: process.env.PROXY_PROVIDER_HOST,
          username: process.env.PROXY_PROVIDER_USER,
          password: process.env.PROXY_PROVIDER_PASS,
        }
      : undefined;
    const apiKey = process.env.ANTHROPIC_API_KEY;
    let matcher;
    if (!apiKey) {
      console.warn("[build] ANTHROPIC_API_KEY not set — using defaultMatcher (first search result)");
    }
    if (apiKey) {
      const cache = makeCacheClient({ railsCallbackBase: payload.railsCallbackBase, hmacSecret: secret });
      const anthropic = (opts) => callClaude({ apiKey, ...opts });
      matcher = makeCachedMatcher({
        userId: payload.userId,
        prefs: payload.preferences,
        cache,
        anthropic,
      });
    }
    // If the client sent a saved Tesco session, parse and pass it through.
    let storageState;
    if (payload.tescoSessionState) {
      try {
        storageState = typeof payload.tescoSessionState === "string"
          ? JSON.parse(payload.tescoSessionState)
          : payload.tescoSessionState;
      } catch { /* invalid JSON — fall back to login */ }
    }

    runBuild({
      buildId: payload.buildId,
      items: payload.items ?? [],
      railsCallbackBase: payload.railsCallbackBase,
      hmacSecret: secret,
      proxy,
      preferences: payload.preferences,
      storageState,
      ...(matcher && { matcher }),
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
