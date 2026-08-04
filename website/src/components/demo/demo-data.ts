export type WorkspaceItem = { id: string; name: string; lastActive: string };

export const demoWorkspaces: WorkspaceItem[] = [
  { id: "research", name: "Research", lastActive: "2m ago" },
  { id: "product-eng", name: "Product eng", lastActive: "1h ago" },
  { id: "ops-weekly", name: "Ops weekly", lastActive: "3h ago" },
  { id: "sandbox", name: "Sandbox", lastActive: "1d ago" },
];

export type TimelineStep = {
  id: string;
  label: string;
  status: "completed" | "running" | "waiting" | "queued" | "failed";
  detail: string;
};

export const demoTimeline: TimelineStep[] = [
  { id: "t1", label: "Reading workspace context", status: "completed", detail: "3 documents, 1 prior thread" },
  { id: "t2", label: "Searching (self-hosted index)", status: "completed", detail: "6 sources found, 2 cross-checked" },
  { id: "t3", label: "Drafting report", status: "completed", detail: "competitive-notes.md, v2" },
  { id: "t4", label: "Requesting approval to post", status: "waiting", detail: "Sensitive action — posting to #research" },
  { id: "t5", label: "Post to workspace channel", status: "queued", detail: "Blocked on approval above" },
];

export type ArtifactItem = {
  id: string;
  type: "diff" | "report" | "document";
  title: string;
  meta: string;
};

export const demoArtifacts: ArtifactItem[] = [
  { id: "a1", type: "report", title: "competitive-notes.md", meta: "v3 · 6 sources cited" },
  { id: "a2", type: "diff", title: "src/routes/billing.ts", meta: "+42 / -11 · awaiting review" },
  { id: "a3", type: "document", title: "Q3-ops-summary.docx", meta: "Generated · office-document skill" },
];

export type ContextItem = { id: string; label: string; kind: "file" | "thread" | "skill" };

export const demoContext: ContextItem[] = [
  { id: "c1", label: "pricing-notes.md", kind: "file" },
  { id: "c2", label: "Dispatch — Research", kind: "thread" },
  { id: "c3", label: "web-search", kind: "skill" },
];

export type ScheduleItem = {
  id: string;
  name: string;
  cadence: string;
  workspace: string;
  status: "active" | "paused";
  lastRun: { date: string; ok: boolean } | null;
  nextRun: string;
};

export const initialSchedules: ScheduleItem[] = [
  {
    id: "s1",
    name: "Weekly ops report",
    cadence: "Weekly · Mon 08:00",
    workspace: "Ops weekly",
    status: "active",
    lastRun: { date: "Jul 14, 08:00", ok: true },
    nextRun: "Jul 21, 08:00",
  },
  {
    id: "s2",
    name: "Competitive research sweep",
    cadence: "Daily · 07:30",
    workspace: "Research",
    status: "active",
    lastRun: { date: "Today, 07:30", ok: true },
    nextRun: "Tomorrow, 07:30",
  },
  {
    id: "s3",
    name: "Dependency audit",
    cadence: "Every 6 hours",
    workspace: "Product eng",
    status: "paused",
    lastRun: { date: "Jul 12, 14:00", ok: false },
    nextRun: "Paused",
  },
];

export type SkillItem = { id: string; name: string; description: string; scope: "Global" | "Project"; enabled: boolean };

export const initialSkills: SkillItem[] = [
  { id: "sk1", name: "Web search", description: "Self-hosted search index for grounded lookups.", scope: "Global", enabled: true },
  { id: "sk2", name: "Office documents", description: "Read and create .xlsx / .docx / .pptx / .pdf files.", scope: "Global", enabled: true },
  { id: "sk3", name: "Answer discipline", description: "Standing answer-quality and certainty-labeling rules.", scope: "Global", enabled: true },
];

export type McpItem = { id: string; name: string; status: "connected" | "not connected"; scope: "Global" | "Project" };

export const initialMcpServers: McpItem[] = [
  { id: "m1", name: "Internal wiki", status: "connected", scope: "Project" },
  { id: "m2", name: "Ticketing system", status: "not connected", scope: "Project" },
];
