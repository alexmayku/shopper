import crypto from "node:crypto";
import { verify } from "../auth.js";
import { launchBrowser } from "../tesco/browser.js";

// In-memory registry of active login sessions.
const sessions = new Map();

export default async function tescoLoginRoutes(fastify, opts) {
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

  // Start a login session: launches a visible Chromium and navigates to the
  // Tesco login page. The user logs in manually — we never touch their
  // credentials. Once logged in, call /complete to capture cookies.
  fastify.post("/tesco-login", async (request, reply) => {
    if (!checkSig(request, reply)) return;

    const loginId = crypto.randomBytes(8).toString("hex");
    const baseUrl = process.env.TESCO_BASE_URL ?? "https://www.tesco.com";
    const loginPath = process.env.TESCO_LOGIN_PATH ?? "/account/login";

    // Launch a visible browser for manual login.
    const handle = await launchBrowser({ headless: false });
    const page = await handle.context.newPage();

    // Navigate to the Tesco login page so the user can sign in.
    page.goto(`${baseUrl}${loginPath}`).catch(() => {});

    sessions.set(loginId, {
      handle,
      page,
      status: "awaiting_login",
      storageState: null,
      error: null,
    });

    return reply.code(202).send({ loginId });
  });

  // Poll login session status.
  fastify.get("/tesco-login/:id/status", async (request, reply) => {
    if (!checkSig(request, reply)) return;
    const session = sessions.get(request.params.id);
    if (!session) return reply.code(404).send({ error: "session_not_found" });
    return reply.send({
      status: session.status,
      error: session.error,
    });
  });

  // Complete the login: capture cookies from the browser and return them.
  // Called after the user has finished logging in (status is "ready" or
  // "needs_verification" and the user has completed 2FA manually).
  fastify.post("/tesco-login/:id/complete", async (request, reply) => {
    if (!checkSig(request, reply)) return;
    const session = sessions.get(request.params.id);
    if (!session) return reply.code(404).send({ error: "session_not_found" });

    try {
      // Capture the latest storage state (cookies may have been updated
      // since programmatic login, e.g. after manual 2FA completion).
      const storageState = await session.handle.context.storageState();
      sessions.delete(request.params.id);
      await session.page.close().catch(() => {});
      await session.handle.cleanup();
      return reply.send({ storageState });
    } catch (e) {
      return reply.code(500).send({ error: e.message });
    }
  });

  // Cancel and clean up a login session.
  fastify.post("/tesco-login/:id/cancel", async (request, reply) => {
    if (!checkSig(request, reply)) return;
    const session = sessions.get(request.params.id);
    if (!session) return reply.code(404).send({ error: "session_not_found" });

    sessions.delete(request.params.id);
    await session.page.close().catch(() => {});
    await session.handle.cleanup();
    return reply.send({ ok: true });
  });
}
