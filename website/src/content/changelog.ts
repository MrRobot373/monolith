export type ChangelogEntry = {
  version: string;
  date: string;
  products: ("Chat" | "Agent" | "Code" | "Platform")[];
  additions: string[];
  improvements: string[];
  fixes: string[];
};

export const changelog: ChangelogEntry[] = [
  {
    version: "2026.07.17",
    date: "2026-07-17",
    products: ["Platform"],
    additions: [],
    improvements: ["Cloud settings group renamed to Account for clarity"],
    fixes: ["Notifications and Usage settings now route correctly"],
  },
  {
    version: "2026.07.13",
    date: "2026-07-13",
    products: ["Platform"],
    additions: ["Supabase-backed account view"],
    improvements: [
      "Settings sidebar restructured for faster navigation",
      "Panels now adapt to the active mode (Chat / Cowork / Code)",
    ],
    fixes: [],
  },
  {
    version: "2026.07.12",
    date: "2026-07-12",
    products: ["Agent", "Platform"],
    additions: [],
    improvements: [
      "Accessibility pass across session views",
      "Terminal panel now loads lazily instead of on every session",
    ],
    fixes: [
      "Fixed a search-schema issue affecting the research agent's citations",
      "Fixed draft-prompt handoff between composer and session",
      "Fixed premature stop-and-retry behavior on long-running runs",
    ],
  },
  {
    version: "2026.07.11 — Model picker",
    date: "2026-07-11",
    products: ["Chat", "Agent", "Code"],
    additions: [],
    improvements: [
      "The model picker now live-probes every candidate model and only shows ones that actually respond — no more picking a model that silently fails",
    ],
    fixes: ["Model seeding now requires a real output, not just an HTTP 200, before trusting a provider"],
  },
  {
    version: "2026.07.11 — Scheduling, Dispatch, Admin",
    date: "2026-07-11",
    products: ["Agent", "Chat", "Platform"],
    additions: [
      "Scheduled tasks: create, pause, resume, run now, and delete, with full run history",
      "A persistent Dispatch thread per workspace",
      "Background session notifications, in-app and via push",
      "Org admin panel: approval mode, search access, member visibility, usage tracking",
    ],
    improvements: [],
    fixes: [],
  },
  {
    version: "2026.07.11 — Projects & task rail",
    date: "2026-07-11",
    products: ["Chat", "Agent", "Code", "Platform"],
    additions: [
      "Projects view for managing workspaces",
      "Task rail: Progress, Artifacts, and Context panels alongside every session",
      "Customize hub for skills, extensions, and MCP servers",
    ],
    improvements: [],
    fixes: [],
  },
  {
    version: "2026.07.10 — Cowork-style workspace",
    date: "2026-07-10",
    products: ["Chat", "Agent", "Code", "Platform"],
    additions: [
      "The current workspace design system and mode tabs (Chat / Cowork / Code)",
      "Sidebar navigation and a proper home screen",
    ],
    improvements: [],
    fixes: [],
  },
];
