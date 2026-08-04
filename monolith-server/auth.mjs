const TOKEN_CACHE_TTL_MS = 60_000;
const MAX_CACHED_TOKENS = 1_000;

function envValue(env, ...names) {
  for (const name of names) {
    const value = env[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function readBooleanFlag(value, fallback) {
  if (!value) return fallback;
  if (/^(1|true|yes|on|required)$/i.test(value)) return true;
  if (/^(0|false|no|off|optional)$/i.test(value)) return false;
  return fallback;
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function readBearerToken(req) {
  const header = String(req.headers.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

function readAdminEmails(env) {
  return new Set(
    envValue(env, "MONOLITH_ADMIN_EMAILS")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

function isAdminUser(user, adminEmails) {
  if (adminEmails.size === 0) return true;
  const email = typeof user?.email === "string" ? user.email.trim().toLowerCase() : "";
  const role = typeof user?.app_metadata?.role === "string" ? user.app_metadata.role : "";
  return role === "admin" || (email && adminEmails.has(email));
}

export function createSupabaseRequestAuthenticator(options = {}) {
  const env = options.env || process.env;
  const supabaseUrl = envValue(env, "SUPABASE_URL", "VITE_SUPABASE_URL").replace(/\/+$/, "");
  const publicKey = envValue(
    env,
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_ANON_KEY",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_ANON_KEY",
  );
  const configured = Boolean(supabaseUrl && publicKey);
  const required = readBooleanFlag(
    envValue(env, "MONOLITH_REQUIRE_AUTH", "VITE_MONOLITH_REQUIRE_SIGNIN"),
    configured,
  );
  const adminEmails = readAdminEmails(env);
  const cache = new Map();

  function pruneCache(now) {
    if (cache.size <= MAX_CACHED_TOKENS) return;
    for (const [token, entry] of cache) {
      if (entry.expiresAt <= now) cache.delete(token);
    }
    while (cache.size > MAX_CACHED_TOKENS) {
      const oldest = cache.keys().next().value;
      if (!oldest) break;
      cache.delete(oldest);
    }
  }

  async function verifyToken(token) {
    const now = Date.now();
    const cached = cache.get(token);
    if (cached && cached.expiresAt > now) return cached.user;

    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: publicKey,
        authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;

    const user = await response.json().catch(() => null);
    if (!user?.id) return null;
    cache.set(token, { user, expiresAt: now + TOKEN_CACHE_TTL_MS });
    pruneCache(now);
    return user;
  }

  async function authorize(req, res, options = {}) {
    if (!required) return true;

    if (!configured) {
      sendJson(res, 503, { ok: false, error: "supabase_not_configured" });
      return false;
    }

    const token = readBearerToken(req);
    if (!token) {
      sendJson(res, 401, { ok: false, error: "auth_required" });
      return false;
    }

    const user = await verifyToken(token).catch(() => null);
    if (!user) {
      sendJson(res, 401, { ok: false, error: "auth_invalid" });
      return false;
    }

    if (options.admin && !isAdminUser(user, adminEmails)) {
      sendJson(res, 403, { ok: false, error: "admin_required" });
      return false;
    }

    req.monolithUser = user;
    return true;
  }

  return { authorize, configured, required };
}
