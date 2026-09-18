// Bearer-token gate for the orchestrator's HTTP surface.
//
// WHY THIS EXISTS: the closed openwork-server binary this orchestrator replaced
// took --openwork-token / --openwork-host-token and enforced them. Our Phase-4
// replacement never implemented that check, while caddy/Caddyfile still routes
// /workspaces*, /workspace/*, /session* etc. AROUND the site's basic_auth on
// the stated assumption that "API paths are protected by the engine's own
// bearer token". That combination left the whole agent surface (workspace
// listing, file read/write, command execution via the opencode proxy)
// reachable unauthenticated on any exposed Docker deployment.
//
// The client side was already complete — the UI sends `Authorization: Bearer
// <MONOLITH_TOKEN>` on BOTH paths it uses:
//   - openwork-server.ts    (REST: /workspaces, /config, ...)
//   - opencode.ts createClient with mode:"openwork"  (the /opencode/* proxy)
// and internal callers (native/start.mjs, monolith-server/index.mjs,
// workspace-files.mjs) send `x-openwork-host-token`. Only verification was
// missing, so this module just closes that loop.
import crypto from "node:crypto";

// Unauthenticated by design: liveness only, no data. native/start.mjs polls
// this before a token could possibly be known, and Docker healthchecks hit it.
const PUBLIC_PATHS = new Set(["/health"]);

/** Timing-safe string compare that never throws on length mismatch. */
function safeEqual(a, b) {
  const left = Buffer.from(String(a ?? ""), "utf8");
  const right = Buffer.from(String(b ?? ""), "utf8");
  if (left.length !== right.length || left.length === 0) return false;
  return crypto.timingSafeEqual(left, right);
}

function bearerOf(req) {
  const raw = req.headers?.authorization;
  if (typeof raw !== "string") return "";
  const match = /^Bearer\s+(.+)$/i.exec(raw.trim());
  return match ? match[1].trim() : "";
}

function hostTokenOf(req) {
  const value = req.headers?.["x-openwork-host-token"];
  return typeof value === "string" ? value.trim() : "";
}

function isLoopbackHost(host) {
  const value = String(host ?? "").trim().toLowerCase();
  return value === "127.0.0.1" || value === "localhost" || value === "::1";
}

/**
 * @param clientToken  shared secret the browser UI sends as `Authorization: Bearer`
 * @param hostToken    elevated secret internal callers send as `x-openwork-host-token`
 * @param host         the interface the server binds to (drives the exposure guard)
 */
export function createOrchestratorAuth({ clientToken, hostToken, host, log = () => {} } = {}) {
  const client = String(clientToken ?? "").trim();
  const elevated = String(hostToken ?? "").trim();
  // Placeholder values shipped in .env.example are treated as "not configured"
  // so a half-finished setup fails the exposure guard below instead of
  // silently "passing" auth with a secret that is public knowledge.
  const isPlaceholder = (value) => !value || value.startsWith("change-me");
  const usableClient = isPlaceholder(client) ? "" : client;
  const usableHost = isPlaceholder(elevated) ? "" : elevated;
  const enforced = Boolean(usableClient || usableHost);

  /**
   * Refuse to boot in the one genuinely dangerous configuration: reachable
   * beyond loopback with no usable token. Returning an error rather than
   * warning-and-continuing is deliberate — warn-and-continue is exactly how
   * the original hole survived a release.
   */
  function exposureError() {
    if (enforced || isLoopbackHost(host)) return null;
    return (
      `refusing to start: bound to ${host} (reachable beyond loopback) with no MONOLITH_TOKEN ` +
      `or MONOLITH_HOST_TOKEN set. Anyone who can reach this port would get unauthenticated ` +
      `agent access (workspace listing, file read/write, command execution). Set MONOLITH_TOKEN ` +
      `in your .env (scripts/new-instance.sh generates one), or bind to 127.0.0.1 for local use.`
    );
  }

  /** @returns {{ok: true} | {ok: false, status: number, error: string}} */
  function check(req, urlPath) {
    if (!enforced) return { ok: true };
    if (req.method === "OPTIONS") return { ok: true }; // CORS preflight carries no auth
    if (PUBLIC_PATHS.has(urlPath)) return { ok: true };

    // The host token is the elevated/internal credential, so it satisfies any
    // route the client token would.
    if (usableHost && safeEqual(hostTokenOf(req), usableHost)) return { ok: true };
    if (usableClient && safeEqual(bearerOf(req), usableClient)) return { ok: true };
    // A host token may also arrive as a bearer (internal callers vary).
    if (usableHost && safeEqual(bearerOf(req), usableHost)) return { ok: true };

    const supplied = bearerOf(req) || hostTokenOf(req);
    return {
      ok: false,
      status: supplied ? 403 : 401,
      error: supplied ? "invalid_token" : "auth_required",
    };
  }

  if (enforced) log("auth: token required on all routes except /health");
  else log(`auth: DISABLED (no usable token configured) — allowed because bound to ${host}`);

  return { check, enforced, exposureError };
}
