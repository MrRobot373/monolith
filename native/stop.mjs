// Force-stop the native stack by killing whatever listens on its ports.
// Use only if the start.cmd window was closed abruptly (normally Ctrl+C is enough).
// Run:  native\stop.cmd
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
try { process.loadEnvFile(path.join(HERE, ".env")); } catch {}

const ports = [
  process.env.OPENWORK_PORT || "8787",
  process.env.OPENCODE_PORT || "4096",
  process.env.UI_PORT || "8080",
  process.env.POOL_PORT || "11435",
];

if (process.platform !== "win32") {
  for (const p of ports) spawnSync("bash", ["-c", `fuser -k ${p}/tcp 2>/dev/null || true`], { stdio: "ignore" });
  console.log(`[stop] signaled processes on ports: ${ports.join(", ")}`);
} else {
  const pids = new Set();
  for (const p of ports) {
    const out = spawnSync("netstat", ["-ano"], { encoding: "utf8" }).stdout || "";
    for (const line of out.split(/\r?\n/)) {
      if (line.includes(`:${p} `) && /LISTENING/i.test(line)) {
        const pid = line.trim().split(/\s+/).pop();
        if (pid && pid !== "0") pids.add(pid);
      }
    }
  }
  if (pids.size === 0) { console.log("[stop] nothing listening on the stack ports."); }
  for (const pid of pids) {
    spawnSync("taskkill", ["/PID", pid, "/T", "/F"], { stdio: "inherit" });
  }
}
console.log("[stop] done. (Ollama, if it was already running before start, is left alone by design unless it held a port above.)");
