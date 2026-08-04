export type Feature = {
  title: string;
  description: string;
};

export type Product = {
  slug: "chat" | "agent" | "code";
  name: string;
  eyebrow: string;
  headline: string;
  description: string;
  color: "accent" | "success" | "warning";
  features: Feature[];
  workflow: { title: string; description: string }[];
  faq: { q: string; a: string }[];
};

export const products: Product[] = [
  {
    slug: "chat",
    name: "MONOLITH Chat",
    eyebrow: "For every team",
    headline: "A private assistant grounded in what your org actually knows.",
    description:
      "MONOLITH Chat is the entry point for every team — research, writing, internal Q&A — answering from your own documents instead of the open web, with nothing sent upstream to train a public model.",
    color: "accent",
    features: [
      {
        title: "Grounded in your own knowledge",
        description:
          "Answers are drawn from documents and context you provide, not just general web training data — so it knows your process, not a stranger's.",
      },
      {
        title: "Persistent, shared workspaces",
        description:
          "Chat history lives per workspace, not per browser tab. Pick up a conversation days later, or hand it to a teammate.",
      },
      {
        title: "Split view",
        description:
          "Run two sessions side by side — compare an answer against a second model, or keep reference material open while you work.",
      },
      {
        title: "A persistent Dispatch thread",
        description:
          "Every workspace keeps one durable thread you can always return to, instead of losing context across a dozen one-off chats.",
      },
      {
        title: "Model choice, mid-conversation",
        description:
          "Switch between a fast local model and a stronger cloud model without starting over — the picker only ever shows models that are actually reachable.",
      },
      {
        title: "Background notifications",
        description:
          "Start something, switch tasks, and get notified in-app (or via push) the moment it finishes or needs your input.",
      },
    ],
    workflow: [
      { title: "Ask", description: "Type a question, @-mention a file, or attach a document." },
      { title: "Ground", description: "MONOLITH answers from your workspace's own context first." },
      { title: "Verify", description: "See exactly what it read and which model answered — nothing is a black box." },
      { title: "Keep it", description: "The thread stays in your workspace, searchable, exportable, yours." },
    ],
    faq: [
      {
        q: "Does Chat use the open web to answer?",
        a: "It can, through a self-hosted search skill your org controls — but it prioritizes your own grounded documents first, and no query is sent to a third-party search API.",
      },
      {
        q: "Can different teams have different chat histories?",
        a: "Yes — chat lives per workspace. Separate workspaces mean separate context and separate history.",
      },
    ],
  },
  {
    slug: "agent",
    name: "MONOLITH Agent",
    eyebrow: "For work that runs itself",
    headline: "Agents that carry out real, multi-step work — on a schedule, if you want.",
    description:
      "MONOLITH Agent goes past a single reply: it researches, checks sources, and executes multi-step tasks inside your security boundary — including fully autonomous runs on a recurring schedule, with a complete history of what happened.",
    color: "success",
    features: [
      {
        title: "Scheduled, autonomous runs",
        description:
          "Set a task to run every N minutes, daily, or weekly. Each run opens a real session, not a simulated log — pause, resume, or trigger one immediately, any time.",
      },
      {
        title: "Cited research",
        description:
          "The research agent produces structured, sourced findings using a self-hosted search index and a page-reading toolkit — not just a confident-sounding paragraph.",
      },
      {
        title: "Human-in-the-loop by default",
        description:
          "Approval mode is manual by default: the agent asks before taking a sensitive action. Switch an org to automatic once you trust the workflow.",
      },
      {
        title: "Full run history",
        description:
          "Every scheduled run is logged with success/failure and a direct link to the session it produced — an audit trail, not a black box.",
      },
      {
        title: "Works with your documents",
        description:
          "Agents can read and produce real spreadsheets, docs, and PDFs directly, not just describe what should be in them.",
      },
      {
        title: "A command palette built for switching",
        description:
          "Jump between agents, search across every workspace's sessions, and manage what's running from one keyboard-first surface.",
      },
    ],
    workflow: [
      { title: "Define the task", description: "Describe the outcome, not the steps — a report, a check, a weekly summary." },
      { title: "Set the cadence (optional)", description: "Run it once now, or schedule it to run on its own from here on." },
      { title: "Watch it work", description: "Follow the run in real time — reads, searches, tool calls — and step in if it asks." },
      { title: "Review the trail", description: "Every run is logged with a pass/fail state and a link to exactly what happened." },
    ],
    faq: [
      {
        q: "Can an agent take irreversible actions on its own?",
        a: "Only if approval mode is set to automatic for that org — manual is the default, and it asks first.",
      },
      {
        q: "What happens if a scheduled run fails?",
        a: "It's recorded in the run history with an error state and a link to the session, so you can see exactly where it stopped.",
      },
    ],
  },
  {
    slug: "code",
    name: "MONOLITH Code",
    eyebrow: "For engineers",
    headline: "A coding agent that ships in your repos — without your code training anyone's model.",
    description:
      "MONOLITH Code reads, writes, and runs code directly in your workspace's real filesystem, the way an engineer already works — with model choice per task and no code retained by an outside vendor.",
    color: "warning",
    features: [
      {
        title: "Works on real files",
        description:
          "Reads, edits, refactors, and runs code in your actual workspace — not a sandboxed toy copy that has to be reconciled later.",
      },
      {
        title: "Looks things up instead of guessing",
        description:
          "Pulls current API and library documentation through a self-hosted search skill before writing against an interface it isn't sure of.",
      },
      {
        title: "Model tiering per task",
        description:
          "Route routine edits to a fast local model and hard problems to a stronger one — your call, mid-session, without losing context.",
      },
      {
        title: "A terminal that opens when you need it",
        description:
          "Code mode surfaces a terminal panel automatically, so command output and test runs are visible as they happen.",
      },
      {
        title: "Nothing trains on your code",
        description:
          "Whether you're on the self-hosted or managed plan, your codebase is never used to train any model, ours or anyone else's.",
      },
      {
        title: "Approval before it runs a command",
        description:
          "Sensitive shell commands and file operations can be gated behind an explicit approval prompt, not executed silently.",
      },
    ],
    workflow: [
      { title: "Point it at the problem", description: "Describe the bug, the feature, or the refactor in plain terms." },
      { title: "It reads before it writes", description: "The agent inspects the actual files and dependencies involved first." },
      { title: "Watch the diff", description: "Changes and command output are visible as they happen, not delivered as a surprise." },
      { title: "Approve and run", description: "Confirm sensitive steps, then let it execute, test, and report back." },
    ],
    faq: [
      {
        q: "Does it need internet access to work?",
        a: "No — it can run entirely against local models and your own repos. Web lookups for docs are optional and go through your own self-hosted search, not a third party.",
      },
      {
        q: "Can it push commits or open pull requests on its own?",
        a: "Only for actions your org has approved — by default it stops and asks before anything irreversible.",
      },
    ],
  },
];

export const productPillars = [
  {
    title: "Agents that do the work, not just describe it",
    description:
      "Chat, research, and coding agents act inside your real workspace — reading real files, running real commands — instead of narrating what a human should do next.",
  },
  {
    title: "Nothing runs invisibly",
    description:
      "A task rail shows progress, artifacts, and context for every session. Scheduled runs keep a full history. You can always see what happened and why.",
  },
  {
    title: "Approval before anything sensitive",
    description:
      "Manual approval is the default — an agent asks before a risky action. Turn it to automatic only once your org is ready to trust the workflow.",
  },
  {
    title: "Work in parallel, review in one place",
    description:
      "Split view runs two sessions side by side. Scheduled tasks keep working in the background while you do something else, and notify you when they're done.",
  },
  {
    title: "Model choice, not model lock-in",
    description:
      "Route between local and cloud models per task. The picker automatically filters out anything that isn't actually reachable, so you never pick a dead model.",
  },
  {
    title: "Extend it with skills, not a vendor ticket",
    description:
      "Web search, office-document handling, and MCP server connections are configurable per deployment — your extensibility surface, not a locked platform.",
  },
];
