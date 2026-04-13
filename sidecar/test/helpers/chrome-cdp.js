// Helper for sidecar tests: launches a Chromium binary directly with a CDP
// remote-debugging port, mimicking what the user does when they run
// `bin/chrome-tesco` to open a real browser the sidecar can attach to.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function waitForCdp(port, { timeoutMs = 15_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return await res.json();
    } catch (_) {
      // not yet ready
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`CDP did not become ready on port ${port} within ${timeoutMs}ms`);
}

export async function startChromeWithCdp() {
  const port = await getFreePort();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "chrome-cdp-test-"));
  const proc = spawn(
    chromium.executablePath(),
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
    ],
    { stdio: "ignore" }
  );

  await waitForCdp(port);
  return {
    cdpUrl: `http://127.0.0.1:${port}`,
    cleanup: async () => {
      proc.kill("SIGTERM");
      await new Promise((r) => setTimeout(r, 200));
      try {
        fs.rmSync(userDataDir, { recursive: true, force: true });
      } catch (_) {
        // best effort
      }
    },
  };
}
