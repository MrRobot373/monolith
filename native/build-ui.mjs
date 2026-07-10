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

const OPENWORK_PORT = process.env.OPENWORK_PORT || "8787";

// Build-time env baked into the bundle. VITE_-prefixed process env is picked up by Vite.
const viteEnv = {
  // Point the UI at the local engine (web deployment, not desktop).
  VITE_OPENWORK_DEPLOYMENT: "web",
  VITE_OPENWORK_URL: process.env.VITE_OPENWORK_URL || `http://127.0.0.1:${OPENWORK_PORT}`,
  VITE_OPENWORK_PORT: OPENWORK_PORT,
  VITE_OPENWORK_TOKEN: process.env.OPENWORK_TOKEN || "",
  VITE_OPENWORK_HOST_TOKEN: process.env.OPENWORK_HOST_TOKEN || "",
  // Neutralize phone-home. NOTE: an EMPTY posthog key falls back to OpenWork's
  // real default key in a production build (analytics.ts:31), so we set a non-empty
  // dummy key AND a black-hole host — nothing can reach PostHog. Belt: the built
  // index.html also seeds analyticsEnabled:false so events never even queue.
  VITE_OPENWORK_POSTHOG_KEY: "monolith-analytics-disabled",
  VITE_OPENWORK_POSTHOG_HOST: "http://127.0.0.1:9",
  VITE_DISABLE_OPENWORK_MODELS: "1", // kills the cloud "OpenWork Models" upsell
  // (VITE_DEN_REQUIRE_SIGNIN left unset -> defaults false -> never forces cloud sign-in)
};

// Optional rebrand of the browser tab title.
const productName = (process.env.PRODUCT_NAME || "").trim();
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
  const tokenSeed = `<script>try{var tKey="openwork.server.token",hKey="openwork.server.hostToken",expectedT="${process.env.OPENWORK_TOKEN || ""}",expectedH="${process.env.OPENWORK_HOST_TOKEN || ""}",currT=localStorage.getItem(tKey),currH=localStorage.getItem(hKey);if(expectedT&&(currT!==expectedT||currH!==expectedH)){localStorage.setItem(tKey,expectedT);if(expectedH){localStorage.setItem(hKey,expectedH);}else{localStorage.removeItem(hKey);}localStorage.removeItem("openwork.server.urlOverride");localStorage.removeItem("openwork.server.port");location.reload();}}catch(e){}</script>`;
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
