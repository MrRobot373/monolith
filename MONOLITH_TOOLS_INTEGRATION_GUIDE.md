# MONOLITH Agent Tools Integration Guide

> **Document Version:** 1.0  
> **Scope:** Comprehensive technical guide for implementing and using agent-facing tools in MONOLITH, modeled after Kimi Work's tool architecture.  
> **Audience:** MONOLITH backend developers, AI engineers, and DevOps.

---

## 1. Executive Summary

MONOLITH's AI agents need a **unified tool layer** — a set of capabilities the agent can invoke to interact with files, run code, query databases, manage cloud resources, and delegate work. This document describes the complete tool architecture used by Kimi Work and provides a step-by-step implementation roadmap so MONOLITH can offer equivalent (or superior) agent tooling.

The architecture is divided into **four tiers**:

| Tier | Name | Description |
|------|------|-------------|
| **T1** | Core Local Tools | File I/O, shell execution, search, text editing |
| **T2** | Runtime & Compute | Python execution, agent delegation, scheduling |
| **T3** | Structured Data & Search | Web search, finance data, academic sources, URL fetching |
| **T4** | Cloud Service MCPs | Cloudflare, GitHub, Supabase, and other third-party APIs |

---

## 2. Tier 1 — Core Local Tools

These are the fundamental building blocks every agent needs. They operate directly on the host filesystem and shell environment.

### 2.1 `Bash` — Shell Command Execution

**Purpose:** Execute arbitrary shell commands with full pipe/redirect/env support.

**When to Use:**
- Git operations (`git clone`, `git commit`, `git push`)
- Package management (`npm install`, `pip install`, `pnpm add`)
- Build/test runners (`npm test`, `pytest`, `docker compose up`)
- Process inspection (`ps`, `top`, `df`)
- Anything requiring shell semantics (pipes, env vars, redirections)

**When NOT to Use:**
- Simple file reads → use `Read` instead
- File search by pattern → use `Glob` instead
- Text search in files → use `Grep` instead
- File creation → use `Write` instead
- In-place text edits → use `Edit` instead

**Implementation Spec for MONOLITH:**
```typescript
interface BashTool {
  command: string;           // The shell command to execute
  cwd?: string;              // Working directory (default: session CWD)
  timeout?: number;          // Max seconds (default: 60, max: 300 foreground)
  description?: string;      // Human-readable reason (shown in UI audit log)
}

interface BashResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  truncated?: boolean;       // If output exceeded limits
}
```

**Security Rules:**
1. Run in a **fresh shell environment** per call — no persistent shell state between calls.
2. Do NOT allow `cd` to persist; always pass `cwd` explicitly.
3. Block commands requiring superuser (`sudo`, `su`) unless explicitly allowed.
4. Never allow access outside the workspace directory unless whitelisted.
5. Sanitize commands that could escape the workspace (`..`, absolute paths).

**Example Use Cases:**
```bash
# Check current time (essential for date-sensitive queries)
date '+%Y-%m-%dT%H:%M:%S%z (%Z)'

# Run tests
npm test

# Check disk space
df -h

# Git status
git status
```

---

### 2.2 `Read` — Text File Reading

**Purpose:** Read UTF-8 text files with pagination support.

**When to Use:**
- Reading configuration files (`.env`, `package.json`, `docker-compose.yml`)
- Reading source code files
- Reading logs
- Reading documentation (`.md` files)

**When NOT to Use:**
- Binary files → use `ReadMediaFile` for images/video
- Directories → use `Bash` with `ls` or `Glob`
- Searching unknown content → use `Grep` first

**Implementation Spec for MONOLITH:**
```typescript
interface ReadTool {
  path: string;              // Absolute or relative file path
  line_offset?: number;      // Start line (1-based; negative = from end)
  n_lines?: number;          // Max lines to read (omit = up to 1000)
}

interface ReadResult {
  lines: Array<{ number: number; content: string }>;
  totalLines: number;
  truncated: boolean;
  lineEnding: 'LF' | 'CRLF' | 'mixed';
}
```

**Pagination Rules:**
- Cap at 1000 lines OR 100 KB per call, whichever comes first.
- Lines longer than 2000 chars are truncated mid-line.
- Use `line_offset` and `n_lines` to page through large files.

**Sensitive File Handling:**
- Refuse to read `.env` files, SSH private keys, credential stores, and similar secrets.
- Allow `.env.example`, `.env.template`, and public SSH keys (`id_rsa.pub`).

---

### 2.3 `Write` — File Creation & Overwriting

**Purpose:** Create new files or completely replace existing ones.

**When to Use:**
- Creating new source files
- Generating reports, charts, data exports
- Writing configuration files from scratch

**When NOT to Use:**
- Small incremental edits → use `Edit` instead
- Appending to a file → use `Write` with `mode: "append"`
- Modifying existing files where continuity matters → use `Edit`

**Implementation Spec for MONOLITH:**
```typescript
interface WriteTool {
  path: string;
  content: string;
  mode?: 'overwrite' | 'append';  // Default: overwrite
}
```

**Rules:**
1. Create missing parent directories automatically (`mkdir -p` behavior).
2. Do NOT create unsolicited documentation files (`README.md`, summaries) unless requested.
3. Read existing files before overwriting when continuity matters.
4. Respect line endings: `\n` stays LF, `\r\n` stays CRLF.

---

### 2.4 `Edit` — Precise Text Replacement

**Purpose:** Make targeted, incremental changes to existing files.

**When to Use:**
- Bug fixes (changing a few lines)
- Adding a field to JSON/config
- Refactoring a function signature
- Any small, scoped change

**When NOT to Use:**
- Complete rewrites → use `Write`
- Multiple non-unique strings without `replace_all` → will fail

**Implementation Spec for MONOLITH:**
```typescript
interface EditTool {
  path: string;
  old_string: string;        // Exact text to find (must be unique unless replace_all)
  new_string: string;        // Replacement text
  replace_all?: boolean;     // Replace every occurrence (default: false)
}
```

**Critical Rules:**
1. **Read the file before every Edit.** Never edit from memory.
2. `old_string` must be unique in the file unless `replace_all: true`.
3. If ambiguous, add surrounding context to `old_string` to ensure uniqueness.
4. Do NOT issue consecutive `Edit` calls on the same file without re-reading.
5. For pure CRLF files, match using LF in `old_string`; the tool writes CRLF back.
6. For mixed endings, include actual `\r` escapes in `old_string`.

**Example:**
```typescript
// Changing a config value
{
  path: "config.json",
  old_string: '"timeout": 30,',
  new_string: '"timeout": 60,'
}
```

---

### 2.5 `Glob` — File Discovery

**Purpose:** Find files by glob pattern, respecting `.gitignore`.

**When to Use:**
- Finding all TypeScript files (`**/*.ts`)
- Finding files in a specific directory (`src/*.js`)
- Discovering config files (`**/*.yaml`)

**When NOT to Use:**
- Searching file contents → use `Grep`
- Simple directory listing → use `Bash` with `ls`

**Implementation Spec for MONOLITH:**
```typescript
interface GlobTool {
  pattern: string;           // e.g., "**/*.ts", "src/*.js", "*.{ts,tsx}"
  path?: string;             // Search root (default: CWD)
  include_ignored?: boolean; // Include .gitignore'd files (default: false)
}

// Returns: string[] — file paths, most recently modified first
```

**Important Patterns:**
- `*.ts` → all `.ts` files recursively (no `/` = recursive)
- `src/*.ts` → files directly in `src/` (one level)
- `src/**/*.ts` → recursive within `src/`
- `{src,test}/**/*.ts` → cartesian brace expansion

**Caveat:**
- Avoid patterns like `node_modules/**/*.js` or `.venv/**/*.py` — they can return thousands of results and hit the 100-file cap.

---

### 2.6 `Grep` — Content Search

**Purpose:** Search file contents using ripgrep-powered regex.

**When to Use:**
- Finding unknown content or locations
- Searching for function definitions across a codebase
- Finding where a variable is used

**When NOT to Use:**
- Known file path → use `Read` directly
- File discovery by name → use `Glob`

**Implementation Spec for MONOLITH:**
```typescript
interface GrepTool {
  pattern: string;           // Regex pattern (ripgrep syntax)
  path?: string;             // File or directory to search
  glob?: string;             // Filter by file pattern (e.g., "*.ts")
  type?: string;             // File type filter (e.g., "ts", "py")
  output_mode?: 'content' | 'files_with_matches' | 'count_matches';
  -i?: boolean;              // Case-insensitive
  -n?: boolean;              // Show line numbers (default: true for content)
  -C?: number;               // Context lines before/after match
  -A?: number;               // Lines after match
  -B?: number;               // Lines before match
  head_limit?: number;       // Limit results (default: 250, 0 = unlimited)
  offset?: number;           // Skip first N results
  include_ignored?: boolean; // Search .gitignore'd files
  multiline?: boolean;       // Allow patterns to span lines
}
```

**Regex Notes:**
- Uses ripgrep syntax (not POSIX grep).
- Braces are special — escape literal `{` as `\{`.
- `.` does not match newlines unless `multiline: true`.

---

## 3. Tier 2 — Runtime, Compute & Delegation

### 3.1 `PythonRun` — Managed Python Execution

**Purpose:** Execute Python code for data analysis, charting, file generation, and one-shot computations.

**When to Use:**
- Data analysis and visualization
- CSV/Excel/PDF generation
- Mathematical computations
- Image processing
- Any computation the user is waiting for

**When NOT to Use:**
- Long-running background jobs → use `Cron` instead
- Simple file operations → use `Read`/`Write`/`Edit`

**Implementation Spec for MONOLITH:**
```typescript
interface PythonRunTool {
  code: string;              // Full Python source defining a function
  function_name?: string;    // Entry function name (default: "main")
  timeoutMs?: number;        // Default: 600,000ms (10 minutes)
}

interface PythonRunResult {
  ok: boolean;
  output: any;               // JSON-serializable return value
  runDir: string;            // Writable directory for this run
  files: string[];           // Files created in runDir
  exitCode: number;
  stderr: string;
}
```

**Runtime Context (`ctx`):**
```python
ctx = {
  "runDir": "/tmp/run-123",       # Writable output directory
  "fontsDir": "/fonts",           # Bundled CJK fonts
  "runtimeRoot": "/runtime",
  "mplConfigDir": "/mpl-config",  # Matplotlib config
  "locale": "en_US",
  "timezone": "America/New_York"
}
```

**Available Libraries:**
- `pandas`, `numpy`, `matplotlib`, `seaborn`
- `pillow` (image processing)
- `openpyxl`, `pypdf`, `python-docx`, `reportlab`
- `beautifulsoup4`, `jinja2`, `markdown-it-py`, `tabulate`
- `duckdb`

**Charting Pattern:**
```python
from daimon_runtime import setup_plot, save_figure
import matplotlib.pyplot as plt

def main(ctx):
    setup_plot(ctx)
    plt.figure(figsize=(10, 6))
    plt.plot([1, 2, 3], [1, 4, 9])
    save_figure(ctx, "chart.png")
    return {"chart": f"{ctx['runDir']}/chart.png"}
```

---

### 3.2 `Agent` — Sub-Agent Delegation

**Purpose:** Launch a sub-agent to handle complex, parallel, or context-heavy tasks while keeping the parent agent's context clean.

**When to Use:**
- Large refactoring tasks spanning many files
- Parallel investigation of independent questions
- Tasks that would overflow context if done inline
- Any substantial work requiring reading many files

**When NOT to Use:**
- Trivial one-step tasks (reading a known file, simple search)
- Tasks where the context handoff cost outweighs the benefit

**Implementation Spec for MONOLITH:**
```typescript
interface AgentTool {
  description: string;       // 3-5 word task summary (for UI display)
  prompt: string;            // Full briefing for the sub-agent
  subagent_type?: 'coder' | 'explore' | 'plan';  // Default: 'coder'
  resume?: string;           // Resume a previous agent by ID
  run_in_background?: boolean; // MUST be false for this environment
}
```

**Prompt Writing Guidelines:**
1. **Brief from zero** — the sub-agent has not seen the parent conversation.
2. Include **exact file paths** for lookups, not "find the config file."
3. For investigations, state the **question**, not prescribed steps.
4. For continued work, use `resume` instead of spawning a new agent.
5. Timeout: default 1800s (30 min), max 3600s (1 hour).

**Sub-Agent Types:**

| Type | Role | Capabilities |
|------|------|-------------|
| `coder` | General engineering | Read, write, edit files; run commands; return summaries |
| `explore` | Codebase exploration | Read-only; fast file finding, search, analysis |
| `plan` | Architecture planning | Read-only; produces implementation plans and trade-off analysis |

**Example Delegation:**
```typescript
{
  description: "Refactor auth module",
  prompt: `Refactor the authentication module in /src/auth/ to use JWT instead of sessions.

Current state:
- /src/auth/session.ts handles session-based auth
- /src/middleware/auth.ts validates sessions
- Tests are in /tests/auth.test.ts

Requirements:
1. Replace session storage with JWT verification
2. Update middleware to check Authorization: Bearer <token> header
3. Update all tests
4. Do not break existing API contracts

Return a summary of all files changed and any breaking changes.`
}
```

---

### 3.3 `Cron` — Scheduled Job Management

**Purpose:** Create and manage recurring, one-time, or manually triggerable automation jobs.

**When to Use:**
- Recurring reports (daily, weekly)
- Nightly data processing
- Periodic health checks
- Delayed one-shot tasks

**When NOT to Use:**
- One-off immediate computation → use `PythonRun`
- User-interactive tasks → handle in the main conversation

**Implementation Spec for MONOLITH:**
```typescript
interface CronTool {
  action: 'create' | 'update' | 'delete' | 'trigger' | 'status' | 'cancel';
  name?: string;             // Job name (for create/update)
  jobId?: string;            // Required for update/delete/trigger/cancel
  enabled?: boolean;         // Enable/disable flag
  trigger?: {
    kind: 'cron' | 'once' | 'manual';
    expr?: string;           // Cron expression (for kind: 'cron')
    at?: string;             // ISO timestamp (for kind: 'once')
  };
  execution?: {
    kind: 'local_conversation';
    prompt?: string;         // The prompt shown in the triggered conversation
    workspacePath?: string;  // Absolute workspace path
    timeoutMs?: number;      // Job timeout
  };
  delivery?: {
    targets: []              // Must be empty for local_conversation
  };
}
```

**Cron Expression Rules:**
- For vague recurring schedules (`daily`, `hourly`), choose a **stable off-peak minute** (7-23 or 37-53), avoiding :00 and :30.
- For exact times (`9:00`, market open), honor the requested timing.
- Include timezone information on creation.

**Example — Daily Report:**
```typescript
{
  action: 'create',
  name: 'daily-intelligence-brief',
  trigger: {
    kind: 'cron',
    expr: '0 17 * * *'  // 5:00 PM daily
  },
  execution: {
    kind: 'local_conversation',
    prompt: 'Generate the daily intelligence brief PDF covering geopolitics, macro policy, supply chains, and tech trends.',
    workspacePath: '/workspace/monolith',
    timeoutMs: 300000
  },
  delivery: { targets: [] }
}
```

---

## 4. Tier 3 — Structured Data & Search Services

These tools provide access to external data sources without requiring the user to set up their own API keys.

### 4.1 `kimi_search_v2` — Web Search

**Purpose:** Search the internet for current information, news, documentation, papers, and releases.

**Implementation Spec for MONOLITH:**
```typescript
interface KimiSearchV2 {
  query: string;
  limit?: number;            // Default: 5, max: 20
  include_content?: boolean; // Include full page content (consumes more tokens)
}
```

**Use Cases:**
- Current news and events
- Product documentation lookups
- Recent research papers
- Verifying time-sensitive facts

**Best Practices:**
- Always search before making claims about current events, prices, or news.
- Use `include_content: true` when deep analysis is needed; `false` for quick fact-checking.

---

### 4.2 `kimi_fetch_v2` — URL Content Extraction

**Purpose:** Fetch and extract main text content from a known URL.

**Implementation Spec for MONOLITH:**
```typescript
interface KimiFetchV2 {
  url: string;               // Target URL
}
```

**Use Cases:**
- Reading documentation pages
- Extracting article content
- Processing web-based reports

---

### 4.3 `kimi_finance_v2` — Stock Market Data

**Purpose:** Real-time stock data for A-shares, HK stocks, and US stocks.

**Implementation Spec for MONOLITH:**
```typescript
interface KimiFinanceV2 {
  ticker: string;            // Comma-separated, max 3 tickers
  type?: 'open_summary' | 'close_summary' | 'realtime_price' | 'realtime_tech';
  time?: string;             // YYYY-MM-DD HH:MM:SS (seconds must be 00)
  file_path: string;         // CSV output path
}
```

**Ticker Format:**
- A-shares: `.SH`, `.SZ`, `.BJ` (e.g., `000001.SZ`)
- HK stocks: `.HK` (e.g., `0700.HK`)
- US stocks: `.US` (e.g., `AAPL.US`)

**Safety:** This tool provides market data only, not trading or investment advice.

---

### 4.4 `kimi_datasource_get_desc_v2` & `kimi_datasource_call_v2` — Structured Data APIs

**Purpose:** Access structured external data sources (Yahoo Finance, World Bank, IMF, arXiv, Scholar, legal databases, etc.).

**Workflow:**
1. Call `kimi_datasource_get_desc_v2` to discover available APIs and parameters.
2. Call `kimi_datasource_call_v2` with the discovered API name and parameters.

**Supported Sources:**
- `stock_finance_data` — Historical financial data
- `yahoo_finance` — Yahoo Finance data
- `tianyancha` — Chinese business registry
- `world_bank_open_data` — Global development indicators
- `imf` — World Economic Outlook data
- `arxiv` — Academic papers
- `scholar` — Google Scholar search
- `yuandian_law` — Chinese legal/case data

---

## 5. Tier 4 — Cloud Service MCPs (Model Context Protocol)

MCPs extend agent capabilities through standardized external tool integrations. MONOLITH should support MCP plugins that expose domain-specific tools.

### 5.1 Cloudflare MCP

**Purpose:** Manage Cloudflare resources (Workers, R2, KV, D1, DNS, Pages, etc.).

**Tools:**
- `docs` — Search Cloudflare developer documentation
- `search` — Search Cloudflare OpenAPI spec for endpoints
- `execute` — Execute Cloudflare API calls via JavaScript

**Implementation Pattern for MONOLITH:**
```typescript
// Step 1: Search for the endpoint
const endpoint = await cloudflare.search({
  code: `(api) => {
    return Object.entries(api.paths)
      .filter(([_, methods]) => methods.post?.tags?.includes('workers'))
      .map(([path, methods]) => ({ path, summary: methods.post?.summary }));
  }`
});

// Step 2: Execute the API call
const result = await cloudflare.execute({
  code: `async () => {
    return cloudflare.request({
      method: 'GET',
      path: '/zones',
      query: { per_page: 10 }
    });
  }`
});
```

**Key Rules:**
- Never invent API paths from memory — always search first.
- Confirm account ID / zone ID before execution.
- Check response bodies, not just HTTP status (GraphQL can return 200 with errors).
- Use UTC ISO 8601 seconds for time filters (`2026-06-16T00:00:00Z`).

---

### 5.2 GitHub MCP

**Purpose:** Full GitHub operations without local clone.

**Categories:**

| Category | Tools |
|----------|-------|
| Repository | Create, fork, list branches/tags, list collaborators |
| Files | Read, write, delete, push multiple files |
| Pull Requests | Create, update, merge, list, search, read diffs |
| Reviews | Create reviews, add comments, resolve threads |
| Issues | Create, update, search, list, manage sub-issues |
| Code Search | Search code, commits, repos, users across GitHub |
| Copilot | Request automated code reviews |
| Secret Scanning | Scan files/diffs for leaked credentials |

**Critical Rules:**
- **State-changing operations** (merge PR, close issue, delete branch) require explicit user confirmation.
- Never paste private repo content verbatim into conversations — summarize + file path + line numbers.
- OAuth scope determines available tools; if a tool is missing, the token lacks the required scope.

---

### 5.3 Supabase MCP

**Purpose:** Full Supabase project management — database, Edge Functions, branching, auth, storage.

**Categories:**

| Category | Tools |
|----------|-------|
| Account | List/create/pause/restore projects, list organizations |
| Database | Execute SQL, apply migrations, list tables/extensions/migrations |
| Branching | Create, delete, merge, rebase, reset branches |
| Functions | List, get, deploy Edge Functions |
| Debugging | Get logs, get advisors (security/performance) |
| Documentation | Search Supabase docs via GraphQL |

**Security Rules:**
- **Production databases:** Append `?read_only=true` to prevent prompt-injection attacks from triggering destructive writes.
- **Multi-project:** Append `?project_ref=xxx` to lock to a single project.
- **Write operations:** Always show SQL/migration content to the user and wait for explicit confirmation before executing.

---

## 6. Task Management: `TodoList`

**Purpose:** Maintain a structured todo list for multi-step tasks.

**When to Use:**
- Any task spanning multiple tool calls
- Tracking investigation progress across a large codebase
- Planning a sequence of edits before making them

**When NOT to Use:**
- Single-shot answers completing in 1-2 calls
- Purely conversational exchanges

**Implementation Spec for MONOLITH:**
```typescript
interface TodoListTool {
  todos?: Array<{
    title: string;           // Short, actionable description
    status: 'pending' | 'in_progress' | 'done';
  }>;
}
```

**Rules:**
1. Mark exactly one item as `in_progress` at a time.
2. Mark tasks `done` immediately after finishing — do not batch completions.
3. Do not re-call when nothing meaningful has changed.
4. Never mark `done` if tests are failing or implementation is partial.

---

## 7. Skills Management: `SkillManage`

**Purpose:** Create, update, and delete reusable procedural knowledge (`SKILL.md` files).

**When to Use:**
- A complex task succeeded after overcoming errors
- A non-trivial workflow was discovered
- User asks to remember a procedure

**Implementation Spec for MONOLITH:**
```typescript
interface SkillManageTool {
  action: 'list' | 'view' | 'create' | 'patch' | 'edit' | 'delete' | 'write_file' | 'remove_file';
  name?: string;             // Skill identifier
  category?: string;         // Optional domain (devops, data-science, etc.)
  content?: string;          // Full SKILL.md content (for create/edit)
  old_string?: string;       // For patch
  new_string?: string;       // For patch
  file_path?: string;        // For write_file/remove_file
  replace_all?: boolean;
}
```

**SKILL.md Format:**
```markdown
---
title: Skill Name
triggers: ["keyword1", "keyword2"]
---

# Skill Name

## When to Use

## Steps

## Pitfalls

## Verification
```

---

## 8. Implementation Architecture for MONOLITH

### 8.1 Recommended Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MONOLITH Agent Core                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Planner    │  │  Tool Router │  │  Context Manager │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└────────────────────┬───────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
┌──────────────┐ ┌──────────┐ ┌──────────────┐
│  Local Tool  │ │  Python  │ │   MCP Hub    │
│   Sandbox    │ │  Runtime │ │  (Plugins)   │
└──────────────┘ └──────────┘ └──────────────┘
```

### 8.2 Local Tool Sandbox

MONOLITH should implement a **sandboxed execution environment** for local tools:

```typescript
// Pseudo-code for MONOLITH's tool execution layer
class LocalToolSandbox {
  private workspaceRoot: string;
  private allowedPaths: string[];

  async executeBash(cmd: string, cwd?: string): Promise<BashResult> {
    // 1. Validate command against blocklist
    if (this.isBlocked(cmd)) throw new SecurityError();
    
    // 2. Resolve working directory
    const workDir = this.resolvePath(cwd || this.workspaceRoot);
    if (!this.isWithinWorkspace(workDir)) throw new PathError();
    
    // 3. Execute in isolated process with timeout
    return await this.spawn(cmd, { cwd: workDir, timeout: 60000 });
  }

  async readFile(path: string): Promise<ReadResult> {
    const resolved = this.resolvePath(path);
    if (this.isSensitiveFile(resolved)) throw new SecurityError();
    return await this.read(resolved);
  }
}
```

### 8.3 Python Runtime Container

```dockerfile
# Dockerfile for MONOLITH's Python runtime
FROM python:3.11-slim

RUN pip install pandas numpy matplotlib seaborn \
    pillow openpyxl pypdf python-docx reportlab \
    beautifulsoup4 jinja2 markdown-it-py tabulate duckdb

WORKDIR /runtime
COPY ./daimon_runtime.py /runtime/

ENTRYPOINT ["python"]
```

### 8.4 MCP Plugin Registry

```typescript
interface MCPPlugin {
  id: string;
  name: string;
  tools: ToolDefinition[];
  authenticate(): Promise<AuthState>;
}

class MCPRegistry {
  private plugins = new Map<string, MCPPlugin>();

  register(plugin: MCPPlugin) {
    this.plugins.set(plugin.id, plugin);
  }

  async execute(pluginId: string, toolName: string, params: any) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) throw new Error(`Plugin ${pluginId} not found`);
    
    // Validate auth state
    const auth = await plugin.authenticate();
    if (!auth.valid) throw new AuthError();
    
    // Execute tool
    return await plugin.tools.find(t => t.name === toolName)!.execute(params);
  }
}
```

### 8.5 Tool Routing Table

MONOLITH's planner should use a routing table to decide which tool to invoke:

```typescript
const toolRoutingTable = [
  // File operations
  { pattern: /read file|show me|what's in/, tool: 'Read' },
  { pattern: /create file|write to|generate/, tool: 'Write' },
  { pattern: /edit|change|update|fix/, tool: 'Edit' },
  { pattern: /find files|list.*files|glob/, tool: 'Glob' },
  { pattern: /search.*code|grep|find.*where/, tool: 'Grep' },
  
  // Execution
  { pattern: /run|execute|bash|shell|git|npm|docker/, tool: 'Bash' },
  { pattern: /python|analyze|chart|plot|compute/, tool: 'PythonRun' },
  
  // Data
  { pattern: /search web|look up|current news|latest/, tool: 'kimi_search_v2' },
  { pattern: /stock|ticker|finance|market/, tool: 'kimi_finance_v2' },
  { pattern: /fetch|scrape|extract.*url/, tool: 'kimi_fetch_v2' },
  
  // Cloud services
  { pattern: /cloudflare|worker|dns|r2|pages/, tool: 'cloudflare_mcp' },
  { pattern: /github|pull request|issue|commit|repo/, tool: 'github_mcp' },
  { pattern: /supabase|postgres|database|edge function/, tool: 'supabase_mcp' },
  
  // Meta
  { pattern: /schedule|cron|recurring|nightly|daily/, tool: 'Cron' },
  { pattern: /delegate|sub-agent|parallel task/, tool: 'Agent' },
];
```

---

## 9. Security Best Practices

### 9.1 File System Security

| Rule | Implementation |
|------|---------------|
| Workspace isolation | All paths resolved relative to workspace root |
| Path traversal prevention | Block `..` sequences and absolute paths outside workspace |
| Sensitive file blocking | Refuse `.env`, private keys, credential stores |
| No silent overwrites | Read existing files before `Write` when continuity matters |

### 9.2 Shell Execution Security

| Rule | Implementation |
|------|---------------|
| Fresh environment | No persistent shell state between calls |
| No superuser | Block `sudo`, `su`, `doas` |
| Timeout enforcement | Default 60s, max 300s for foreground tasks |
| Command validation | Block dangerous commands (`rm -rf /`, `mkfs`, etc.) |

### 9.3 MCP Authentication Security

| Rule | Implementation |
|------|---------------|
| Token isolation | Store tokens in secure vault, never log them |
| Scope validation | Check OAuth scopes before exposing tools |
| Read-only by default | For production databases, enforce read-only mode |
| Confirmation for writes | Require explicit user confirmation for destructive operations |

### 9.4 Prompt Injection Prevention

| Rule | Implementation |
|------|---------------|
| SQL guardrails | Validate all SQL before execution; never execute `DROP` without confirmation |
| Content sanitization | Strip or escape instruction-override patterns in user content |
| Database read-only mode | Append `?read_only=true` for shared/production databases |
| Audit logging | Log all tool invocations with descriptions for accountability |

---

## 10. Error Handling Patterns

### 10.1 Tool Failure Categories

| Category | Examples | Agent Response |
|----------|----------|---------------|
| **Authentication** | 401, invalid token, session expired | Check auth state, offer re-authentication |
| **Permission** | 403, not authorized, missing entitlement | Verify scope/permissions, offer fallback |
| **Input Validation** | Missing parameters, invalid format | Correct parameters and retry |
| **Resource Not Found** | 404, file missing, zone not found | Verify IDs/paths, report to user |
| **Rate Limiting** | 429, budget depleted | Back off, reduce request size, wait |
| **Timeout** | Operation exceeded time limit | Reduce scope, delegate to sub-agent |
| **Unknown** | Unexpected errors, server failures | Report clearly, offer fallback |

### 10.2 Retry Strategy

```typescript
async function executeWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  backoffMs = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      if (error.code === 'RATE_LIMITED') {
        await sleep(backoffMs * attempt);
        continue;
      }
      if (error.code === 'AUTH_ERROR') {
        throw error; // Don't retry auth errors
      }
    }
  }
  throw new Error('Max retries exceeded');
}
```

---

## 11. Integration Checklist for MONOLITH

### Phase 1 — Core Local Tools (Week 1-2)
- [ ] Implement `Bash` tool with sandboxing and timeout
- [ ] Implement `Read` tool with pagination and sensitive-file filtering
- [ ] Implement `Write` tool with directory auto-creation
- [ ] Implement `Edit` tool with unique-string matching
- [ ] Implement `Glob` tool with `.gitignore` respect
- [ ] Implement `Grep` tool with ripgrep backend

### Phase 2 — Runtime & Compute (Week 3)
- [ ] Set up Python runtime container with required libraries
- [ ] Implement `PythonRun` tool with `ctx` injection
- [ ] Implement `Agent` delegation with sub-agent lifecycle
- [ ] Implement `Cron` scheduler backend

### Phase 3 — External Data (Week 4)
- [ ] Integrate `kimi_search_v2` for web search
- [ ] Integrate `kimi_fetch_v2` for URL fetching
- [ ] Integrate `kimi_finance_v2` for stock data
- [ ] Integrate `kimi_datasource_*` for structured data APIs

### Phase 4 — MCP Plugins (Week 5-6)
- [ ] Implement MCP plugin registry
- [ ] Integrate Cloudflare MCP (docs, search, execute)
- [ ] Integrate GitHub MCP (repos, PRs, issues, code search)
- [ ] Integrate Supabase MCP (database, functions, branching)

### Phase 5 — Polish (Week 7)
- [ ] Implement `TodoList` for task tracking
- [ ] Implement `SkillManage` for skill CRUD
- [ ] Implement `ReadMediaFile` for image/video viewing
- [ ] Add comprehensive audit logging
- [ ] Security review and penetration testing

---

## 12. Summary

MONOLITH's agent needs a **four-tier tool architecture** to be competitive with modern AI agents:

1. **Tier 1 (Core Local):** File operations, search, shell execution — the basics every developer needs.
2. **Tier 2 (Runtime):** Python execution, agent delegation, scheduling — the power tools for complex workflows.
3. **Tier 3 (Data):** Web search, finance data, structured APIs — the knowledge layer.
4. **Tier 4 (Cloud MCPs):** Cloudflare, GitHub, Supabase — the infrastructure management layer.

Key principles to follow:
- **Security first:** Sandbox everything, block dangerous operations, never log credentials.
- **Fail gracefully:** Categorize errors, retry intelligently, always offer fallbacks.
- **Confirm destructiveness:** Any write/delete/deploy operation requires explicit user confirmation.
- **Keep context clean:** Delegate large tasks to sub-agents; paginate large file reads.
- **Audit everything:** Log every tool call with a human-readable description.

---

*End of Document*
