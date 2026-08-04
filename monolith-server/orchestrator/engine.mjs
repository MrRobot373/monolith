// MONOLITH engine supervisor — runs OUR vendored opencode from source via bun.
//
// This replaces the closed, prebuilt openwork.exe: we spawn opencode's headless
// server (packages/opencode/src/index.ts serve) through the bun interpreter,
// which Smart App Control allows (bun is signed/reputable) even though it blocks
// the unsigned prebuilt binary. See the independence program plan.
//
// One opencode server serves every workspace directory; each proxied request
// carries the workspace's path in its ?directory= param.
import { spawn } from "node:child_process";
import path from "node:path";
import net from "node:net";

const isWin = process.platform === "win32";

async function findFreePort(preferred) {
  const tryPort = (port) =>
    new Promise((resolve) => {
      const srv = net.createServer();
      srv.once("error", () => resolve(0));
      srv.listen(port, "127.0.0.1", () => {
        const actual = srv.address().port;
        srv.close(() => resolve(actual));
      });
    });
  if (preferred) {
    const got = await tryPort(preferred);
    if (got) return got;
  }
  return tryPort(0);
}

/**
 * @param {object} opts
 * @param {string} opts.opencodeDir  path to vendored engine/opencode
 * @param {number} [opts.port]       preferred port (default 4096)
 * @param {string} [opts.host]       default 127.0.0.1
 * @param {(...a:any)=>void} [opts.log]
 * @param {Record<string,string>} [opts.env]
 */
export function createEngine(opts) {
  const opencodeDir = opts.opencodeDir;
  const host = opts.host || "127.0.0.1";
  const preferredPort = opts.port || 4096;
  const log = opts.log || ((...a) => console.log("[engine]", ...a));
  const env = opts.env || process.env;
  const entry = path.join(opencodeDir, "packages", "opencode", "src", "index.ts");

  let child = null;
  let port = 0;
  let starting = null;
  let stopped = false;

  const base = () => (port ? `http://${host}:${port}` : null);

  async function waitHealthy(timeoutMs = 180_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (stopped) throw new Error("engine stopped during startup");
      try {
        const res = await fetch(`${base()}/doc`, { signal: AbortSignal.timeout(3000) });
        if (res.ok) return true;
      } catch {
        // not up yet
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error(`opencode engine did not become healthy within ${timeoutMs}ms`);
  }

  function spawnEngine() {
    // bun is a .cmd/.exe on PATH → needs a shell on Windows.
    child = spawn(
      "bun",
      ["run", "--conditions=browser", entry, "serve", "--port", String(port), "--hostname", host],
      { cwd: opencodeDir, env: { ...env }, shell: isWin, stdio: ["ignore", "pipe", "pipe"] },
    );
    child.stdout.on("data", (d) => log(`opencode: ${String(d).trimEnd()}`));
    child.stderr.on("data", (d) => log(`opencode: ${String(d).trimEnd()}`));
    child.on("exit", (code) => {
      log(`opencode exited (${code})`);
      child = null;
      starting = null;
      // Auto-restart unless we asked it to stop (keeps the product resilient).
      if (!stopped) setTimeout(() => void start(), 1500);
    });
  }

  function start() {
    if (child) return Promise.resolve(base());
    if (!starting) {
      starting = (async () => {
        stopped = false;
        port = await findFreePort(preferredPort);
        log(`starting opencode (from source) on ${host}:${port} …`);
        spawnEngine();
        await waitHealthy();
        log(`opencode ready at ${base()}`);
        return base();
      })();
    }
    return starting;
  }

  function stop() {
    stopped = true;
    if (child?.pid) {
      if (isWin) spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      else try { child.kill("SIGTERM"); } catch { /* already gone */ }
    }
    child = null;
    port = 0;
    starting = null;
  }

  return {
    start,
    stop,
    baseUrl: base,
    ready: () => Boolean(child) && Boolean(port),
  };
}
