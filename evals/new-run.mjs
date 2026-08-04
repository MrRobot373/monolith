// Phase 0 evaluation runner fixture (dep-free).
// Creates a unique run ID, an isolated throwaway workspace, and a result
// skeleton in evals/results/. Fill in scores as you execute
// MONOLITH_EVALUATION_SCRIPT.md, then check with: node evals/validate-result.mjs
//
// Usage:
//   node evals/new-run.mjs --slug baseline --provider openrouter --model qwen/qwen3-coder [--stack native|docker]
//   node evals/new-run.mjs --cleanup <runId>     # delete a run's sandbox workspace
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EVALS_DIR = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.join(EVALS_DIR, "results");
const SANDBOXES_DIR = path.join(EVALS_DIR, "sandboxes");

export const TESTS = [
  { id: "A", name: "Tool calling and project creation", maxScore: 10 },
  { id: "B", name: "Read-only inspection", maxScore: 10 },
  { id: "C", name: "Autonomous bug-fix workflow", maxScore: 15 },
  { id: "D", name: "Ambiguous product requirement", maxScore: 15 },
  { id: "E", name: "Output generation", maxScore: 10 },
  { id: "F", name: "Failure recovery", maxScore: 10 },
  { id: "G", name: "Safety and cleanup discipline", maxScore: 10 },
  { id: "H", name: "Long-session memory and handoff", maxScore: 10 },
];

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function nextRunId(date, slug) {
  const existing = fs.existsSync(RESULTS_DIR) ? fs.readdirSync(RESULTS_DIR) : [];
  let nn = 0;
  const prefix = `${date}-${slug}-`;
  for (const file of existing) {
    const match = file.match(/^(\d{4}-\d{2}-\d{2}-[a-z0-9-]+)-(\d{2})\.json$/);
    if (match && `${match[1]}-` === prefix) nn = Math.max(nn, Number(match[2]));
  }
  return `${prefix}${String(nn + 1).padStart(2, "0")}`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.cleanup) {
    const sandbox = path.join(SANDBOXES_DIR, String(args.cleanup));
    if (!fs.existsSync(sandbox)) {
      console.error(`No sandbox found for run ${args.cleanup}`);
      process.exit(1);
    }
    fs.rmSync(sandbox, { recursive: true, force: true });
    console.log(`Deleted sandbox ${sandbox}`);
    return;
  }

  const slug = String(args.slug || "run").toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    console.error("--slug must be lowercase letters/digits/hyphens");
    process.exit(1);
  }
  const provider = args.provider ? String(args.provider) : null;
  const model = args.model ? String(args.model) : null;
  if (!provider || !model) {
    console.error("--provider and --model are required (record what you actually benchmark).");
    process.exit(1);
  }
  const stack = String(args.stack || "native");
  if (!["native", "docker"].includes(stack)) {
    console.error("--stack must be native or docker");
    process.exit(1);
  }

  const date = new Date().toISOString().slice(0, 10);
  const runId = nextRunId(date, slug);
  const workspace = path.join(SANDBOXES_DIR, runId, "workspace");
  fs.mkdirSync(workspace, { recursive: true });
  fs.mkdirSync(RESULTS_DIR, { recursive: true });

  const skeleton = {
    runId,
    createdAt: new Date().toISOString(),
    benchmark: { name: "MONOLITH Workflow Evaluation", version: 1, script: "MONOLITH_EVALUATION_SCRIPT.md" },
    environment: { tier: "local", stack, workspace },
    provider,
    model,
    tests: TESTS.map((test) => ({
      ...test,
      score: null,
      safetyGateFailed: false,
      toolCallsSuccessful: null,
      testsActuallyRun: null,
      evidence: "",
    })),
    totalScore: null,
    maxScore: 90,
    safetyGateFailures: 0,
    criticalFailures: [],
    passed: false,
    durationMinutes: null,
    retries: null,
    notes: "",
  };

  const resultPath = path.join(RESULTS_DIR, `${runId}.json`);
  fs.writeFileSync(resultPath, JSON.stringify(skeleton, null, 2) + "\n");

  console.log(`Run ID:            ${runId}`);
  console.log(`Sandbox workspace: ${workspace}`);
  console.log(`Result skeleton:   ${resultPath}`);
  console.log("");
  console.log("Next steps:");
  console.log("  1. Select the sandbox workspace as a new local workspace in MONOLITH.");
  console.log("  2. Run MONOLITH_EVALUATION_SCRIPT.md tests A-H, filling scores + evidence.");
  console.log(`  3. node evals/validate-result.mjs results/${runId}.json`);
  console.log(`  4. node evals/new-run.mjs --cleanup ${runId}   (when done)`);
}

main();
