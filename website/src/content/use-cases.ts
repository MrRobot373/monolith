export type UseCase = {
  slug: string;
  category: "Engineering" | "Research" | "Operations" | "Security & IT";
  title: string;
  outcome: string;
  description: string;
  products: ("chat" | "agent" | "code")[];
  problem: string;
  workflowSteps: { title: string; description: string }[];
  toolsUsed: string[];
  safetyNotes: string;
};

export const useCases: UseCase[] = [
  {
    slug: "private-assistant-for-every-team",
    category: "Operations",
    title: "Give every team a private assistant, without a new vendor per team",
    outcome: "One deployment, grounded answers, nothing sent upstream to train a public model.",
    description:
      "Instead of a patchwork of AI chat subscriptions across departments — each with its own data-handling terms — every team gets the same grounded assistant, on infrastructure your org already controls.",
    products: ["chat"],
    problem:
      "Different teams reach for whatever AI chat tool is convenient, each with different (and often unclear) data-retention and training policies. IT has no single point of control or visibility.",
    workflowSteps: [
      { title: "One deployment, many workspaces", description: "Each team or department gets its own workspace with its own grounded context." },
      { title: "Answers stay grounded", description: "Chat draws from the team's own documents before reaching for the open web." },
      { title: "Admins keep visibility", description: "Org-level controls show usage and let IT govern access without policing every conversation." },
    ],
    toolsUsed: ["MONOLITH Chat", "Self-hosted search"],
    safetyNotes:
      "Approval mode and search access are configurable per organization, so IT sets the guardrails once rather than per team.",
  },
  {
    slug: "scheduled-research-report",
    category: "Research",
    title: "Turn a standing research question into a report that writes itself weekly",
    outcome: "A cited report lands in the workspace on a schedule — no one has to remember to run it.",
    description:
      "Point the research agent at a recurring question — competitive landscape, industry news, an internal metric review — and let it run on a schedule instead of re-asking it manually every week.",
    products: ["agent"],
    problem:
      "Recurring research and reporting work is exactly the kind of task that quietly stops happening once the person who owned it gets busy.",
    workflowSteps: [
      { title: "Describe the standing question", description: "Write the research brief once, the way you'd hand it to an analyst." },
      { title: "Set the cadence", description: "Weekly, daily, or every N minutes — the schedule runs on its own from here." },
      { title: "Review the run history", description: "Every run is logged with success/failure and a link to the actual session and citations." },
    ],
    toolsUsed: ["MONOLITH Agent", "Scheduled tasks", "Self-hosted search"],
    safetyNotes:
      "Scheduled runs default to the org's configured approval mode — sensitive actions still require a human sign-off unless explicitly automated.",
  },
  {
    slug: "engineers-ship-without-third-party-training",
    category: "Engineering",
    title: "Let engineers use an AI coding agent without the codebase leaving the building",
    outcome: "Real edits in real repos, with model choice per task and no code retained by an outside vendor.",
    description:
      "Engineering teams get an agent that reads, edits, and runs code directly in the workspace's filesystem — without sending proprietary source to a third party's training pipeline.",
    products: ["code"],
    problem:
      "Public coding assistants are useful, but pointing one at a proprietary codebase means trusting a vendor's training and retention policy with your actual source.",
    workflowSteps: [
      { title: "Point it at the task", description: "Describe the bug or feature the way you'd brief a teammate." },
      { title: "It reads before it writes", description: "The agent inspects real files and dependencies before proposing a change." },
      { title: "Review the diff, approve the run", description: "Sensitive commands are gated behind approval; the diff is visible before it ships." },
    ],
    toolsUsed: ["MONOLITH Code", "Model tiering (local + cloud)"],
    safetyNotes:
      "Shell commands and file operations can require explicit approval before executing, so nothing runs unattended by default.",
  },
  {
    slug: "air-gapped-deployment",
    category: "Security & IT",
    title: "Run AI entirely inside an air-gapped or tightly controlled network",
    outcome: "The full platform — chat, agents, coding — running with zero external dependency on a public AI vendor.",
    description:
      "For environments where sending anything to an external API isn't an option, the self-hosted plan runs the entire stack — reverse proxy, model gateway, local models — inside a network you already control.",
    products: ["chat", "agent", "code"],
    problem:
      "Regulated or high-sensitivity environments often can't use any AI product that requires an outbound connection to a third-party vendor, no matter how favorable the vendor's terms.",
    workflowSteps: [
      { title: "Deploy the stack on your infrastructure", description: "Docker Compose brings up the reverse proxy, model gateway, and workspace containers." },
      { title: "Point the gateway at local models", description: "Local models run entirely within your network — no external model calls required." },
      { title: "Provision users with isolation", description: "Each user gets an isolated container and volume set, proven not to cross over." },
    ],
    toolsUsed: ["Self-hosted deployment", "Local model routing"],
    safetyNotes:
      "This is the deployment path for organizations where 'no data leaves the network' is a hard requirement, not a preference.",
  },
  {
    slug: "managed-instance-without-new-vendor-contract",
    category: "Security & IT",
    title: "Stand up an isolated AI environment for a department without a new ops project",
    outcome: "A dedicated, isolated environment live quickly — same privacy guarantee, no infrastructure to provision.",
    description:
      "When a department needs private AI now and infrastructure isn't ready, the managed plan gives them the same architecture and the same no-training guarantee, operated by MONOLITH instead of an internal ops team.",
    products: ["chat", "agent", "code"],
    problem:
      "Provisioning new infrastructure for a pilot can take longer than the pilot itself — but the alternative shouldn't be a public AI tool with unclear data handling.",
    workflowSteps: [
      { title: "Request a dedicated environment", description: "No shared multi-tenant pool — a single isolated deployment for the organization." },
      { title: "Onboard the team", description: "Same product, same guarantees, none of the provisioning work." },
      { title: "Migrate later if needed", description: "The managed and self-hosted plans share the same architecture, so moving isn't a rebuild." },
    ],
    toolsUsed: ["Managed deployment"],
    safetyNotes:
      "Because it's the same stack as self-hosting, moving from managed to self-hosted later doesn't mean re-evaluating a different product's security model.",
  },
  {
    slug: "internal-report-automation",
    category: "Operations",
    title: "Automate the weekly internal report nobody enjoys compiling",
    outcome: "A recurring operational summary, generated and delivered on schedule, reviewable before it goes out.",
    description:
      "Status round-ups, usage summaries, and operational reviews are exactly the repetitive, structured writing that a scheduled agent run handles well — freeing the person who used to own it for less repetitive work.",
    products: ["agent", "chat"],
    problem:
      "Recurring internal reporting is high-friction, low-glamour work that's easy to deprioritize under deadline pressure, even though it matters for visibility.",
    workflowSteps: [
      { title: "Define the report once", description: "Describe the sources and the format the way you'd brief whoever compiles it today." },
      { title: "Schedule it", description: "Weekly or daily — it runs without anyone remembering to kick it off." },
      { title: "Review before it's shared", description: "Manual approval mode means a human signs off before anything goes out, if you want that gate." },
    ],
    toolsUsed: ["MONOLITH Agent", "Scheduled tasks", "MONOLITH Chat"],
    safetyNotes:
      "Approval mode determines whether the report is delivered automatically or held for review — the org decides which.",
  },
];

export const useCaseCategories = ["Engineering", "Research", "Operations", "Security & IT"] as const;
