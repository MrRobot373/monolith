import type { ContentBlock } from "@/lib/blocks";

export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  category: "Architecture" | "Product" | "Engineering";
  date: string;
  author: string;
  readMinutes: number;
  content: ContentBlock[];
};

export const blogPosts: BlogPost[] = [
  {
    slug: "two-deployment-paths-one-guarantee",
    title: "Two deployment paths, one guarantee",
    excerpt:
      "Why MONOLITH ships as the same architecture whether you run it yourself or we run it for you — and why that's a harder promise to keep than it sounds.",
    category: "Architecture",
    date: "2026-07-14",
    author: "MONOLITH team",
    readMinutes: 5,
    content: [
      {
        type: "p",
        text: "The easiest way to build a 'self-hosted or managed' product is to build two products: a lightweight open thing people run themselves, and a separate, more polished cloud service that's actually where the real engineering investment goes. We didn't do that, and it was a deliberate call.",
      },
      {
        type: "p",
        text: "MONOLITH's managed plan runs the exact same Docker Compose stack as the self-hosted one — the same reverse proxy, the same per-user isolation model, the same model-routing gateway. The only variable that changes is who operates it.",
      },
      { type: "h2", text: "Why not build a 'real' managed product?" },
      {
        type: "p",
        text: "Because the moment the managed plan becomes architecturally different from self-hosting, the privacy guarantee stops being a property of the software and starts being a claim about a different piece of software you have to trust separately. We wanted 'your data never trains a model' to be true because of how the thing is built, not because of a policy document describing a different system.",
      },
      {
        type: "p",
        text: "It also means a customer who starts managed and later needs to move to self-hosted — because a new compliance requirement shows up, or their infrastructure team wants it in-house — isn't migrating to a different product. They're moving the same deployable stack onto infrastructure they operate.",
      },
      { type: "h2", text: "The honest trade-off" },
      {
        type: "p",
        text: "This isn't free. It means the managed plan can't (yet) offer things a purpose-built multi-tenant SaaS product might — deeper autoscaling, a more elaborate admin console, tenant-level feature flags. What it does offer is a guarantee that's actually verifiable: it's the same code, the same isolation model, whichever way you run it.",
      },
    ],
  },
  {
    slug: "what-happens-when-an-agent-runs-on-a-schedule",
    title: "What actually happens when an agent runs on a schedule",
    excerpt:
      "Scheduled tasks aren't a cron job that pastes a canned message somewhere. Here's what a scheduled run actually does, end to end.",
    category: "Product",
    date: "2026-07-11",
    author: "MONOLITH team",
    readMinutes: 4,
    content: [
      {
        type: "p",
        text: "It's easy to build a 'scheduled AI task' feature that's really just a cron job hitting an API and dropping the output in a log. We wanted scheduled tasks to produce the same thing a person would get if they'd sat down and run the task manually — so that's what we built.",
      },
      {
        type: "p",
        text: "When a scheduled task fires, it opens a real engine session — the same kind of session you'd get starting a conversation by hand — titled with the task name. It isn't a special, stripped-down execution path; it's the actual agent, with the actual tools it would have if you'd triggered it yourself.",
      },
      { type: "h2", text: "Three cadences, one history" },
      {
        type: "ul",
        items: [
          "Every N minutes, for tight monitoring loops",
          "Daily, at a fixed time, for standing reports",
          "Weekly, on a chosen day and time, for recurring reviews",
        ],
      },
      {
        type: "p",
        text: "Every run — success or failure — is recorded with a link back to the session it produced. If a run fails, you're not staring at a log line; you're looking at the actual conversation up to the point it stopped, which is usually enough to see exactly what went wrong.",
      },
      { type: "h2", text: "Why this matters more than it sounds like it should" },
      {
        type: "p",
        text: "The single biggest failure mode for 'automate this' work isn't that the automation breaks — it's that nobody notices when it silently stops running, or nobody trusts the output enough to act on it without re-checking everything by hand. A real run history, linked to a real session, is what makes it possible to actually trust a scheduled run instead of treating it as a black box that occasionally emails you something.",
      },
    ],
  },
  {
    slug: "the-dead-model-problem",
    title: "The dead-model problem, and how we filter for it",
    excerpt:
      "Model pickers usually show you a list of names. Ours shows you a list of models that actually responded the last time we checked.",
    category: "Engineering",
    date: "2026-07-11",
    author: "MONOLITH team",
    readMinutes: 3,
    content: [
      {
        type: "p",
        text: "Most model pickers are static: a list of provider names and model IDs someone configured once. The problem is that 'configured' and 'reachable' are different things — a provider's API can be down, a key can expire, a model can be deprecated — and the picker has no idea. The user finds out only after they've already sent a message into the void.",
      },
      {
        type: "p",
        text: "MONOLITH's model picker doesn't trust configuration alone. Before a model shows up as selectable, it's live-probed with a minimal real request — not a health-check ping, an actual completion call — and the result is cached for a window so we're not hammering providers on every page load. If it doesn't come back with real output, it doesn't appear in the list.",
      },
      { type: "h2", text: "Why 'HTTP 200' wasn't good enough" },
      {
        type: "p",
        text: "An earlier version of this check considered a 200 status code sufficient proof a model was working. It wasn't — some failure modes return a 200 with an empty or malformed response. The probe now requires an actual, real output before a model is trusted, which sounds like a small distinction and turned out to matter a lot in practice.",
      },
      {
        type: "p",
        text: "The result is unglamorous but exactly what you want from infrastructure: you open the picker, and every model in the list actually works, right now, without you having to find out the hard way.",
      },
    ],
  },
];
