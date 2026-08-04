export type DemoCase = {
  slug: string;
  category: string;
  title: string;
  outcome: string;
  detail: string;
  steps: string[];
};

export const demoCases: DemoCase[] = [
  {
    slug: "research-to-report",
    category: "Agent · Research",
    title: "Research brief to a cited report",
    outcome: "A standing research question, answered with sources, without anyone re-running it by hand.",
    detail:
      "A research brief goes in once. The agent searches a self-hosted index, reads the relevant pages, cross-checks claims across sources, and produces a structured, cited report in the workspace — either immediately, or on a recurring schedule.",
    steps: [
      "Brief the agent the way you'd brief an analyst",
      "It searches, reads, and cross-checks sources",
      "A cited report lands in the workspace, reviewable and linked back to its sources",
    ],
  },
  {
    slug: "real-code-change",
    category: "Code",
    title: "A real code change, start to finish",
    outcome: "An edit in an actual repository, reviewed as a diff before anything ships.",
    detail:
      "Point the coding agent at a bug or a feature. It reads the relevant files and dependencies, makes the change directly in your workspace, and surfaces the diff and command output as it happens — not as a surprise at the end.",
    steps: [
      "Describe the bug or feature in plain terms",
      "The agent reads before it writes, then makes the change",
      "Review the diff and approve any sensitive commands before it runs",
    ],
  },
  {
    slug: "scheduled-review",
    category: "Agent · Scheduled",
    title: "An operational review that runs itself",
    outcome: "A weekly summary that shows up on its own — no one has to remember to run it.",
    detail:
      "A recurring task — a status round-up, a usage review, a metrics check — runs on a schedule you set. Every run is logged with a pass/fail state and a link to the actual session, so it's trustworthy, not just automatic.",
    steps: [
      "Define the report once, the way you'd brief whoever compiles it today",
      "Set a weekly or daily cadence",
      "Review the run history — every run links back to what actually happened",
    ],
  },
  {
    slug: "grounded-team-qa",
    category: "Chat",
    title: "Grounded answers for every team",
    outcome: "One assistant, many workspaces, answers drawn from your own context instead of the open web.",
    detail:
      "Each team gets its own workspace with its own grounded context. Questions are answered from documents you provide first, with model choice available mid-conversation and nothing sent upstream to train a public model.",
    steps: [
      "Ask a question or attach a document",
      "MONOLITH answers from your workspace's own context first",
      "The thread stays in your workspace — searchable, exportable, yours",
    ],
  },
];
