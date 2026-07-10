// Validates each OLLAMA_KEY_* against the cloud endpoint and lists available models.
// Prints only pass/fail per key index (never the key itself). Use to confirm the pool
// is healthy and to see which model ids to declare.
//
// Run:  node native/pool-check.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
try { process.loadEnvFile(path.join(HERE, ".env")); } catch {}

const BASE = (process.env.OLLAMA_POOL_BASE || "https://ollama.com/v1").trim().replace(/\/+$/, "");
const keyNames = Object.keys(process.env)
  .filter((k) => /^OLLAMA_KEY_\d+$/.test(k) && (process.env[k] || "").trim())
  .sort((a, b) => Number(a.split("_").pop()) - Number(b.split("_").pop()));

if (!keyNames.length) { console.log("no OLLAMA_KEY_* set"); process.exit(0); }

const modelSets = new Map();
let ok = 0;
const failed = [];

for (const name of keyNames) {
  const idx = name.split("_").pop();
  try {
    const r = await fetch(`${BASE}/models`, { headers: { authorization: `Bearer ${process.env[name].trim()}` } });
    if (r.ok) {
      ok++;
      const body = await r.json().catch(() => ({}));
      const ids = (body.data || body.models || []).map((m) => m.id || m.name).filter(Boolean).sort();
      modelSets.set(idx, ids);
    } else {
      failed.push(`#${idx} -> HTTP ${r.status}`);
    }
  } catch (e) {
    failed.push(`#${idx} -> ${e.message}`);
  }
}

console.log(`\n[pool-check] endpoint: ${BASE}`);
console.log(`[pool-check] keys OK: ${ok}/${keyNames.length}`);
if (failed.length) console.log(`[pool-check] failed: ${failed.join(", ")}`);

// Show the model catalog from the first working key.
const firstOk = [...modelSets.values()][0];
if (firstOk) {
  console.log(`\n[pool-check] ${firstOk.length} models available on the pool:`);
  for (const id of firstOk) console.log(`  ${id}`);
}
