import type { ContentBlock } from "@/lib/blocks";

export type DocPage = {
  slug: string;
  category: string;
  title: string;
  description: string;
  content: ContentBlock[];
};

export const docsCategories = [
  "Getting Started",
  "Deployment",
  "Chat",
  "Agent",
  "Code",
  "Platform",
  "Security",
  "Troubleshooting",
] as const;

export const docsPages: DocPage[] = [
  {
    slug: "getting-started/overview",
    category: "Getting Started",
    title: "What MONOLITH is",
    description: "A private AI workspace — chat, agents, and a coding assistant — deployed on your infrastructure or ours.",
    content: [
      {
        type: "p",
        text: "MONOLITH is an AI workspace built around three capabilities — Chat, Agent, and Code — deployed one of two ways: entirely on your own infrastructure, or as an isolated, dedicated environment we operate for you. Both paths run the same architecture, and neither ever uses your data to train a model.",
      },
      {
        type: "p",
        text: "Under the hood, MONOLITH is assembled from vetted open-source foundations rather than built from scratch, with a policy, product, and audit layer around them: a reverse proxy for access control, a model-routing gateway that can wire in local and cloud models behind one interface, and per-user isolated workspace containers.",
      },
      { type: "h2", text: "The three capabilities" },
      {
        type: "ul",
        items: [
          "Chat — a grounded assistant for every team, see Chat docs",
          "Agent — multi-step and scheduled autonomous work, see Agent docs",
          "Code — a coding agent that works in real repos, see Code docs",
        ],
      },
      { type: "h2", text: "The two deployment paths" },
      {
        type: "p",
        text: "Self-hosted and managed run the same underlying stack. The difference is purely operational — who runs the servers — not a difference in architecture or guarantees. See the Deployment docs for detail on both.",
      },
    ],
  },
  {
    slug: "getting-started/quick-start-docker",
    category: "Getting Started",
    title: "Quick start: Docker Compose",
    description: "Bring up the full self-hosted stack locally in a few commands.",
    content: [
      {
        type: "p",
        text: "The self-hosted deployment path is a Docker Compose stack: a reverse proxy, a model-routing gateway, local model runtime, and the workspace engine. This is the fastest way to see the real platform running.",
      },
      {
        type: "code",
        lang: "bash",
        text: "cp .env.example .env\n# add a provider key for stronger answers, e.g. ANTHROPIC_API_KEY=\ndocker compose up -d --build",
      },
      {
        type: "p",
        text: "Pull a local model to test with before wiring in a cloud key:",
      },
      {
        type: "code",
        lang: "bash",
        text: "docker compose exec ollama ollama pull qwen2.5:0.5b",
      },
      {
        type: "callout",
        tone: "info",
        text: "The bundled local test model is intentionally tiny — good for verifying the stack is wired correctly, not for evaluating answer quality. Add a cloud provider key for real use.",
      },
      { type: "h2", text: "Adding a model provider" },
      {
        type: "p",
        text: "Put one provider key in .env (Anthropic recommended for quality) and recreate the gateway service to pick it up.",
      },
      {
        type: "code",
        lang: "bash",
        text: "docker compose up -d --force-recreate litellm",
      },
      { type: "h2", text: "Multi-user setup" },
      {
        type: "p",
        text: "Each additional user gets an isolated container, volumes, login, and a budgeted key against the model gateway:",
      },
      {
        type: "code",
        lang: "bash",
        text: "scripts/add-user.sh alice 20 alicepass",
      },
    ],
  },
  {
    slug: "getting-started/quick-start-native",
    category: "Getting Started",
    title: "Quick start: native (single machine, no Docker)",
    description: "A lightweight, local-first path for evaluating MONOLITH on a single machine without Docker.",
    content: [
      {
        type: "p",
        text: "For a single-user evaluation without standing up Docker, MONOLITH also runs natively: the real workspace UI served locally, backed by local models. It's not a substitute for the multi-user self-hosted deployment — there's no reverse-proxy auth layer or per-user isolation in this mode — but it's the fastest way to try the actual product on your own machine.",
      },
      {
        type: "p",
        text: "This path runs entirely against local models by default. Cloud model access is optional and requires your own provider keys — there's no bundled multi-provider gateway in this mode the way there is in the Docker deployment.",
      },
      {
        type: "callout",
        tone: "warning",
        text: "The native path is single-user and local-model-first. For team rollout, org admin controls, or cloud-model routing, use the Docker Compose deployment.",
      },
    ],
  },
  {
    slug: "deployment/self-hosted",
    category: "Deployment",
    title: "Self-hosted deployment",
    description: "Run the full stack on your own infrastructure.",
    content: [
      {
        type: "p",
        text: "Self-hosted MONOLITH is a Docker Compose stack you deploy on infrastructure you already control — your cloud account, your data center, or an air-gapped network. Every layer, from the reverse proxy to the model gateway, runs on your servers.",
      },
      { type: "h2", text: "What's included" },
      {
        type: "ul",
        items: [
          "A reverse proxy handling access control and routing",
          "A model-routing gateway that can wire in local and/or cloud model providers",
          "Isolated container and volume per user, provisioned via a setup script",
          "Backup and restore scripts covering all persistent state",
        ],
      },
      { type: "h2", text: "Operating it" },
      {
        type: "p",
        text: "Provisioning, backups, and admin-password rotation are all scriptable rather than requiring a bespoke ops runbook — see the operations reference in Getting Started for the actual commands.",
      },
    ],
  },
  {
    slug: "deployment/managed",
    category: "Deployment",
    title: "Managed deployment",
    description: "The same stack, operated by MONOLITH.",
    content: [
      {
        type: "p",
        text: "The managed plan runs the identical architecture as self-hosting — the same reverse proxy, the same per-user isolation, the same model-routing gateway — operated by MONOLITH instead of your own team.",
      },
      {
        type: "callout",
        tone: "info",
        text: "Managed is not a separate, more scalable product tier — it's an operating-model choice on the same deployable stack. Anything true of self-hosted architecture is true here too.",
      },
      { type: "h2", text: "What MONOLITH handles" },
      {
        type: "ul",
        items: [
          "Provisioning a dedicated, isolated environment for your organization",
          "Updates, uptime, and scaling",
          "The same no-training, data-never-leaves-your-tenant guarantee as self-hosting",
        ],
      },
    ],
  },
  {
    slug: "chat/grounding-and-workspaces",
    category: "Chat",
    title: "Grounding and workspaces",
    description: "How Chat answers from your own context instead of the open web.",
    content: [
      {
        type: "p",
        text: "Each workspace maintains its own grounded context and chat history. When you ask a question, MONOLITH prioritizes what it knows from your workspace's own documents before reaching for general knowledge.",
      },
      {
        type: "p",
        text: "Web lookups, when needed, go through a self-hosted search skill your deployment controls — not a third-party search API — so queries about your work don't leave your environment either.",
      },
      { type: "h2", text: "Split view and Dispatch" },
      {
        type: "p",
        text: "Split view lets you run two sessions side by side. Every workspace also keeps one persistent Dispatch thread — a durable place to return to instead of losing context across one-off chats.",
      },
    ],
  },
  {
    slug: "agent/scheduled-tasks",
    category: "Agent",
    title: "Scheduled tasks",
    description: "Run an agent once, or set it to run on a recurring cadence.",
    content: [
      {
        type: "p",
        text: "A scheduled task fires a real engine session — not a stripped-down execution path — on a cadence you choose: every N minutes, daily at a fixed time, or weekly on a chosen day and time.",
      },
      { type: "h2", text: "Managing a schedule" },
      {
        type: "ul",
        items: [
          "Create a schedule with a task prompt, cadence, and target workspace",
          "Pause, resume, or trigger a run immediately at any time",
          "Delete a schedule when it's no longer needed",
        ],
      },
      {
        type: "p",
        text: "Every run is recorded with a success/failure state and a direct link to the session it produced, so a failed run is debuggable, not just a log line.",
      },
    ],
  },
  {
    slug: "agent/approval-mode",
    category: "Agent",
    title: "Approval mode",
    description: "Manual by default: agents ask before acting on anything sensitive.",
    content: [
      {
        type: "p",
        text: "Every organization has an approval mode setting: manual or automatic. Manual is the default — an agent stops and asks before taking a sensitive action, such as running a command or writing a file outside expected bounds.",
      },
      {
        type: "callout",
        tone: "warning",
        text: "Automatic mode should only be enabled once your org has evaluated the workflows running under it — it removes the human checkpoint before sensitive actions.",
      },
      {
        type: "p",
        text: "Within a session, individual tool calls can also surface an explicit approval prompt — approve once, or for the rest of the session — giving a finer-grained checkpoint than the org-wide setting alone.",
      },
    ],
  },
  {
    slug: "code/coding-agent",
    category: "Code",
    title: "The coding agent",
    description: "How MONOLITH Code reads, writes, and runs code in your real workspace.",
    content: [
      {
        type: "p",
        text: "The coding agent operates directly on your workspace's real filesystem — reading, editing, and running code, not working against a disconnected sandbox copy that has to be reconciled afterward.",
      },
      { type: "h2", text: "Model tiering" },
      {
        type: "p",
        text: "Route routine edits to a fast local model and harder problems to a stronger model, mid-session, without losing context. Code mode also auto-opens a terminal panel so command and test output is visible as it happens.",
      },
      { type: "h2", text: "Nothing trains on your code" },
      {
        type: "p",
        text: "On either deployment plan, your codebase is never used to train any model — ours or any upstream provider's.",
      },
    ],
  },
  {
    slug: "platform/model-routing",
    category: "Platform",
    title: "Model routing and the live picker",
    description: "How MONOLITH chooses which models to show, and why dead models never appear.",
    content: [
      {
        type: "p",
        text: "The model picker doesn't trust static configuration. Every candidate model is live-probed with a real request before it's considered selectable, and the result is cached for a window rather than re-checked on every page load.",
      },
      {
        type: "p",
        text: "In the Docker deployment, a model-routing gateway can wire together multiple providers — local and cloud — behind one interface, with automatic fallback if a preferred model becomes unreachable. In the native, single-machine path, routing is local-model-first with optional cloud providers if you supply your own keys.",
      },
    ],
  },
  {
    slug: "platform/skills-and-mcp",
    category: "Platform",
    title: "Skills and MCP servers",
    description: "How MONOLITH is extended without a vendor ticket.",
    content: [
      {
        type: "p",
        text: "Agents are extended through skills — self-contained capabilities like web search, or reading and creating office documents — and MCP server connections, both configurable per deployment through the Customize surface.",
      },
      {
        type: "p",
        text: "This is deliberately a smaller, more direct extensibility model than a full plugin marketplace: skills and MCP connections are things your deployment enables, not products purchased separately.",
      },
    ],
  },
  {
    slug: "platform/admin-and-usage",
    category: "Platform",
    title: "Org admin and usage",
    description: "What an org admin can see and control.",
    content: [
      {
        type: "ul",
        items: [
          "Toggle approval mode (manual/automatic) for the organization",
          "Toggle web search capability",
          "View the member list",
          "View org-wide model spend and per-model usage breakdown",
        ],
      },
      {
        type: "callout",
        tone: "info",
        text: "Usage and spend tracking depend on the model-routing gateway and are fully available in the Docker deployment; the single-machine native path shows a clean 'unavailable' state instead, since there's no shared gateway to report from.",
      },
    ],
  },
  {
    slug: "security/architecture",
    category: "Security",
    title: "Security architecture",
    description: "What's true of the architecture today, and what isn't built yet.",
    content: [
      { type: "h2", text: "What's real today" },
      {
        type: "ul",
        items: [
          "Host-level password authentication before reaching the application",
          "A real in-app account system with a verified sign-up flow",
          "Proven per-user container and data isolation — no session crossover",
          "Org admin controls: approval mode, search access, member visibility, usage tracking",
        ],
      },
      { type: "h2", text: "What isn't built yet — don't assume otherwise" },
      {
        type: "ul",
        items: [
          "No true single sign-on yet — access today is host-level password auth per subdomain",
          "No compliance certifications currently held (SOC 2, ISO 27001, HIPAA, or similar)",
          "No fine-grained role-based permissions beyond admin vs. member",
          "No self-serve one-click data export button in the product UI",
        ],
      },
      {
        type: "callout",
        tone: "warning",
        text: "This list is intentionally explicit. If you need any of the items above for a compliance review, confirm current status directly rather than assuming from general marketing language.",
      },
    ],
  },
  {
    slug: "troubleshooting/common-issues",
    category: "Troubleshooting",
    title: "Common issues",
    description: "Frequently hit snags and what they usually mean.",
    content: [
      {
        type: "h3",
        text: "The model picker is empty or only shows a local model",
      },
      {
        type: "p",
        text: "The picker only shows models that passed a live probe. If a cloud model isn't appearing, check that its provider key is present and valid, then recreate the gateway service so it re-probes.",
      },
      { type: "h3", text: "Usage/spend shows 'unavailable'" },
      {
        type: "p",
        text: "This is expected on the native, single-machine deployment path, which has no shared model-routing gateway to report spend from. It's fully available on the Docker deployment.",
      },
      { type: "h3", text: "A scheduled task didn't run" },
      {
        type: "p",
        text: "Check the run history for that schedule first — a failed run is logged with a link to the session, which usually shows exactly where it stopped.",
      },
    ],
  },
];
