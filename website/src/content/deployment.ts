export type DeploymentPlan = {
  slug: "self-hosted" | "managed";
  name: string;
  eyebrow: string;
  tagline: string;
  description: string;
  color: "cool" | "warm";
  bestFor: string[];
  included: string[];
  cta: string;
};

export const deploymentPlans: DeploymentPlan[] = [
  {
    slug: "self-hosted",
    name: "On Your Infrastructure",
    eyebrow: "Plan 01 — Self-hosted",
    tagline: "You run it. You own every layer.",
    description:
      "MONOLITH deploys as a Docker Compose stack: a reverse proxy, isolated containers and volumes per user, and a model gateway you point at your own cloud, data center, or air-gapped network. Your team owns the servers, the network, and the keys.",
    color: "cool",
    bestFor: [
      "Regulated or air-gapped environments with strict data-residency rules",
      "Teams with existing infrastructure and ops capacity",
      "Organizations that need to fit MONOLITH into an existing security review, not start a new one",
    ],
    included: [
      "Full Docker Compose stack — reverse proxy, model gateway, per-user isolation",
      "Setup scripts for provisioning users, backups, and restores",
      "Direct control over which model providers are wired in",
      "No data ever leaves infrastructure you control",
    ],
    cta: "Talk to us about self-hosting",
  },
  {
    slug: "managed",
    name: "On MONOLITH Infrastructure",
    eyebrow: "Plan 02 — Managed",
    tagline: "Same architecture. We operate it for you.",
    description:
      "The same deployable stack, operated by MONOLITH instead of your own ops team. Every organization gets an isolated, dedicated environment — never a shared multi-tenant pool — with identical data-isolation guarantees to self-hosting.",
    color: "warm",
    bestFor: [
      "Teams that want the privacy guarantee without running their own ops",
      "Fast rollout — evaluate the platform without provisioning infrastructure first",
      "Organizations that will migrate to self-hosting later and want to start on the same architecture",
    ],
    included: [
      "A dedicated environment per organization — isolation, not multi-tenancy",
      "MONOLITH handles updates, uptime, and scaling",
      "The same no-training, data-never-leaves-your-tenant guarantee as self-hosting",
      "A clear migration path to self-hosting if your infrastructure needs change",
    ],
    cta: "Talk to us about managed hosting",
  },
];

export const sharedGuarantees = [
  {
    key: "Data residency",
    value: "Your infrastructure, or an isolated regional tenant on ours — never a shared pool.",
  },
  {
    key: "Model training",
    value: "Never. Your data is not used to train any model, ours or anyone else's, on either plan.",
  },
  {
    key: "Isolation",
    value: "One dedicated environment per organization, proven — no session or data crossover.",
  },
  {
    key: "Backups",
    value: "Volume-level backup and restore tooling covers workspace data, sessions, and model routing state.",
  },
];

export const comparisonRows = [
  {
    label: "Where your data lives",
    bad: "Vendor's cloud, vendor's terms",
    good: "Your infrastructure, or an isolated tenant on ours",
  },
  {
    label: "Model training",
    bad: "May train on your prompts, depending on plan and settings",
    good: "Never trains on your data — full stop",
  },
  {
    label: "Deployment control",
    bad: "None — fixed by the vendor",
    good: "You choose: self-hosted or managed, same architecture either way",
  },
  {
    label: "Access & audit",
    bad: "Vendor dashboard, limited visibility",
    good: "Org admin controls and full run history, owned by you",
  },
  {
    label: "Vendor lock-in",
    bad: "Proprietary history, no export path",
    good: "Your data lives in your infrastructure or your dedicated tenant",
  },
];
