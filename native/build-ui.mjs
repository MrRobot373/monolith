// Builds OpenWork's REAL web UI (openwork/apps/app) into a static SPA, with all
// phone-home neutralized and the local engine wired in at build time.
//
// Reuses the recipe proven in webui/Dockerfile, minus Docker. Output: openwork/apps/app/dist
// Run:  node native/build-ui.mjs
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
try { process.loadEnvFile(path.join(HERE, ".env")); } catch { /* fall back to .env.example defaults below */ }

const OPENWORK = path.resolve(HERE, "..", "openwork");
const APP = path.join(OPENWORK, "apps", "app");
if (!fs.existsSync(APP)) {
  console.error(`[build-ui] missing ${APP} — is the openwork/ clone present?`);
  process.exit(1);
}

const MONOLITH_PORT = process.env.MONOLITH_PORT || process.env.OPENWORK_PORT || "8787";

// Build-time env baked into the bundle. VITE_-prefixed process env is picked up by Vite.
const viteEnv = {
  // Point the UI at the local engine (web deployment, not desktop).
  VITE_MONOLITH_DEPLOYMENT: "web",
  VITE_MONOLITH_URL: process.env.VITE_MONOLITH_URL || `http://127.0.0.1:${MONOLITH_PORT}`,
  VITE_MONOLITH_PORT: MONOLITH_PORT,
  // The OPENWORK_* fallback matters: existing native/.env files predate the
  // MONOLITH_* rename, and the orchestrator's auth gate reads the same pair
  // with the same fallback. If these two disagree the server enforces a token
  // the UI never received, which locks the browser out of a working install.
  VITE_MONOLITH_TOKEN: process.env.MONOLITH_TOKEN || process.env.OPENWORK_TOKEN || "",
  VITE_MONOLITH_HOST_TOKEN: process.env.MONOLITH_HOST_TOKEN || process.env.OPENWORK_HOST_TOKEN || "",
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "",
  VITE_SUPABASE_PUBLISHABLE_KEY:
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "",
  VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "",
  VITE_MONOLITH_REQUIRE_SIGNIN: process.env.VITE_MONOLITH_REQUIRE_SIGNIN || process.env.MONOLITH_REQUIRE_AUTH || "",
  // Neutralize phone-home. NOTE: an EMPTY posthog key falls back to OpenWork's
  // real default key in a production build (analytics.ts:31), so we set a non-empty
  // dummy key AND a black-hole host — nothing can reach PostHog. Belt: the built
  // index.html also seeds analyticsEnabled:false so events never even queue.
  VITE_MONOLITH_POSTHOG_KEY: "monolith-analytics-disabled",
  VITE_MONOLITH_POSTHOG_HOST: "http://127.0.0.1:9",
  VITE_DISABLE_OPENWORK_MODELS: "1", // kills the cloud "OpenWork Models" upsell
  // (VITE_DEN_REQUIRE_SIGNIN left unset -> defaults false -> never forces cloud sign-in)
};

// Rebrand the browser tab title. Defaults to "MONOLITH" (matching the Docker
// build's default in webui/Dockerfile) rather than silently keeping
// upstream's "OpenWork" title when unset.
const productName = (process.env.PRODUCT_NAME || process.env.MONOLITH_PRODUCT_NAME || "MONOLITH").trim();
if (productName) {
  for (const f of ["index.html", "overlay.html"]) {
    const p = path.join(APP, f);
    if (!fs.existsSync(p)) continue;
    const html = fs.readFileSync(p, "utf8").replace(/<title>[^<]*<\/title>/g, `<title>${productName}</title>`);
    fs.writeFileSync(p, html);
  }
  console.log(`[build-ui] title rebranded -> "${productName}"`);
}

const run = (cmd, args, label) => {
  console.log(`[build-ui] ${label}: ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, {
    cwd: OPENWORK,
    stdio: "inherit",
    shell: true, // resolves pnpm/pnpm.cmd on Windows
    env: { ...process.env, ...viteEnv },
  });
  if (r.status !== 0) {
    console.error(`[build-ui] step failed: ${label}`);
    process.exit(r.status || 1);
  }
};

// Install app + workspace deps if not present (fast no-op once installed).
if (!fs.existsSync(path.join(APP, "node_modules"))) {
  run("pnpm", ["install", "--frozen-lockfile", "--filter", '"@openwork/app..."'], "install app deps");
}
run("pnpm", ["--filter", "@openwork/app", "build"], "vite build");

const dist = path.join(APP, "dist");
const indexHtml = path.join(dist, "index.html");

if (fs.existsSync(indexHtml)) {
  const analyticsSeed = `<script>try{var K="openwork.preferences",p=JSON.parse(localStorage.getItem(K)||"{}");if(p&&typeof p==="object"&&p.analyticsEnabled===undefined){p.analyticsEnabled=false;localStorage.setItem(K,JSON.stringify(p));}}catch(e){}</script>`;
  const expectedOpenworkUrl = String(viteEnv.VITE_MONOLITH_URL || "").replace(/\/+$/, "");
  const expectedOpencodeUrl = expectedOpenworkUrl ? `${expectedOpenworkUrl}/opencode` : "";
  const tokenSeed = `<script>try{var tKey="openwork.server.token",hKey="openwork.server.hostToken",uKey="openwork.server.urlOverride",pKey="openwork.server.port",aKey="openwork.server.active",lKey="openwork.server.list",expectedT=${JSON.stringify(process.env.MONOLITH_TOKEN || process.env.OPENWORK_TOKEN || "")},expectedH=${JSON.stringify(process.env.MONOLITH_HOST_TOKEN || process.env.OPENWORK_HOST_TOKEN || "")},expectedU=${JSON.stringify(expectedOpenworkUrl)},expectedP=${JSON.stringify(MONOLITH_PORT)},expectedO=${JSON.stringify(expectedOpencodeUrl)},changed=false;if(expectedT&&localStorage.getItem(tKey)!==expectedT){localStorage.setItem(tKey,expectedT);changed=true;}if(expectedH){if(localStorage.getItem(hKey)!==expectedH){localStorage.setItem(hKey,expectedH);changed=true;}}else if(localStorage.getItem(hKey)){localStorage.removeItem(hKey);changed=true;}if(expectedU&&localStorage.getItem(uKey)!==expectedU){localStorage.setItem(uKey,expectedU);changed=true;}if(expectedP&&localStorage.getItem(pKey)!==expectedP){localStorage.setItem(pKey,expectedP);changed=true;}if(expectedO){var expectedList=JSON.stringify([expectedO]);if(localStorage.getItem(aKey)!==expectedO){localStorage.setItem(aKey,expectedO);changed=true;}if(localStorage.getItem(lKey)!==expectedList){localStorage.setItem(lKey,expectedList);changed=true;}}if(changed){location.reload();}}catch(e){}</script>`;
  let html = fs.readFileSync(indexHtml, "utf8");
  if (!html.includes("openwork.preferences")) {
    html = html.replace("</head>", `${analyticsSeed}${tokenSeed}</head>`);
    fs.writeFileSync(indexHtml, html);
    console.log("[build-ui] injected analytics-off and token-sync preference seeds into index.html");
  }
}

console.log(fs.existsSync(indexHtml)
  ? `[build-ui] OK -> ${dist}`
  : `[build-ui] WARNING: build finished but ${dist}\\index.html not found`);
