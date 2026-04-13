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

    // Launch browser for login. Use "new" headless mode which supports CDP
    // screencast — frames are captured at the render engine level without
    // needing a display. Falls back to visible if DISPLAY is available.
    const handle = await launchBrowser({ headless: true });
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

  // WebSocket endpoint: streams CDP screencast frames and accepts input events.
  // Authenticated via a signed token in the query string.
  fastify.get("/tesco-login/:id/ws", { websocket: true }, (socket, request) => {
    const loginId = request.params.id;
    const token = request.query?.token;

    // Verify token (token = HMAC of loginId).
    if (!token || !verify(loginId, token, secret)) {
      socket.close(4001, "unauthorized");
      return;
    }

    const session = sessions.get(loginId);
    if (!session) {
      socket.close(4004, "session_not_found");
      return;
    }

    let cdpSession = null;

    (async () => {
      try {
        // Get a CDP session for the page to control screencast and input.
        // Playwright-extra wraps chromium, so we access CDP via the page's
        // createCDPSession method (Playwright's public API).
        cdpSession = await session.page.context().newCDPSession(session.page);

        // Start screencast — sends JPEG frames at up to ~15fps.
        cdpSession.on("Page.screencastFrame", (params) => {
          // Acknowledge the frame so CDP sends the next one.
          cdpSession.send("Page.screencastFrameAck", { sessionId: params.sessionId }).catch(() => {});
          // Send the base64-decoded JPEG as binary.
          const buf = Buffer.from(params.data, "base64");
          if (socket.readyState === 1) socket.send(buf);
        });

        await cdpSession.send("Page.startScreencast", {
          format: "jpeg",
          quality: 70,
          maxWidth: 1280,
          maxHeight: 800,
        });
      } catch (e) {
        // If CDP screencast fails, fall back to periodic screenshots.
        console.log(`[tesco-login] CDP screencast failed (${e.message}), using screenshot fallback`);
        const interval = setInterval(async () => {
          try {
            if (socket.readyState !== 1) { clearInterval(interval); return; }
            const buf = await session.page.screenshot({ type: "jpeg", quality: 70 });
            socket.send(buf);
          } catch {
            clearInterval(interval);
          }
        }, 200);

        socket.on("close", () => clearInterval(interval));
      }
    })();

    // Handle input from the client.
    socket.on("message", async (raw) => {
      if (!cdpSession) return;
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "click") {
          await cdpSession.send("Input.dispatchMouseEvent", {
            type: "mousePressed", x: msg.x, y: msg.y, button: "left", clickCount: 1,
          });
          await cdpSession.send("Input.dispatchMouseEvent", {
            type: "mouseReleased", x: msg.x, y: msg.y, button: "left", clickCount: 1,
          });
        } else if (msg.type === "keydown") {
          await cdpSession.send("Input.dispatchKeyEvent", {
            type: "keyDown", key: msg.key, code: msg.code, text: msg.key.length === 1 ? msg.key : "",
          });
          await cdpSession.send("Input.dispatchKeyEvent", {
            type: "keyUp", key: msg.key, code: msg.code,
          });
        } else if (msg.type === "scroll") {
          await cdpSession.send("Input.dispatchMouseEvent", {
            type: "mouseWheel", x: msg.x, y: msg.y, deltaX: msg.deltaX ?? 0, deltaY: msg.deltaY ?? 0,
          });
        }
      } catch {
        // Ignore input errors — browser may be navigating.
      }
    });

    socket.on("close", () => {
      if (cdpSession) {
        cdpSession.send("Page.stopScreencast").catch(() => {});
        cdpSession.detach().catch(() => {});
      }
    });
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
