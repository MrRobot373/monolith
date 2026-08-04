export type PricingTier = {
  slug: string;
  name: string;
  price: string;
  priceNote: string;
  description: string;
  cta: string;
  ctaHref: string;
  highlighted?: boolean;
  features: string[];
};

export const pricingTiers: PricingTier[] = [
  {
    slug: "self-hosted",
    name: "Self-Hosted",
    price: "Custom",
    priceNote: "You provide the infrastructure",
    description:
      "Deploy the full MONOLITH stack on infrastructure you already control. Pricing depends on scale and support level.",
    cta: "Talk to us about self-hosting",
    ctaHref: "/deployment#self-hosted",
    features: [
      "Full platform: Chat, Agent, Code",
      "Unlimited users, limited only by your infrastructure",
      "Deployment and provisioning scripts included",
      "Choice of local and/or cloud model providers",
      "Community setup guidance via docs",
    ],
  },
  {
    slug: "managed",
    name: "Managed",
    price: "Custom",
    priceNote: "Per-organization, based on team size and usage",
    description:
      "MONOLITH runs a dedicated, isolated environment for your organization. Same guarantees as self-hosting, none of the ops.",
    cta: "Talk to sales",
    ctaHref: "/deployment#managed",
    highlighted: true,
    features: [
      "Full platform: Chat, Agent, Code",
      "Dedicated environment — not shared multi-tenancy",
      "MONOLITH handles updates, uptime, and scaling",
      "Org admin controls and usage tracking included",
      "Migration path to self-hosting if your needs change",
    ],
  },
  {
    slug: "enterprise",
    name: "Enterprise",
    price: "Custom",
    priceNote: "For larger organizations with specific requirements",
    description:
      "For organizations that need dedicated support, custom onboarding, or deployment requirements beyond the standard managed plan.",
    cta: "Talk to sales",
    ctaHref: "/deployment#managed",
    features: [
      "Everything in Managed",
      "Dedicated onboarding and rollout support",
      "Priority support channel",
      "Deployment consultation for regulated or air-gapped environments",
    ],
  },
];

export const pricingFaqs = [
  {
    q: "Why isn't there a fixed price on this page?",
    a: "MONOLITH pricing depends on deployment shape, team size, and infrastructure — the same way most enterprise infrastructure is priced. Talk to us and we'll scope it against your actual usage.",
  },
  {
    q: "Is self-hosting actually free?",
    a: "The platform itself is deployable on your own infrastructure; you're responsible for the infrastructure costs (compute, storage, model provider keys if you use cloud models). Support and onboarding plans are available separately.",
  },
  {
    q: "Can we start managed and move to self-hosted later?",
    a: "Yes — both plans run the same underlying architecture, so moving from managed to self-hosted is a deployment change, not a product migration.",
  },
  {
    q: "Do you charge per seat?",
    a: "Pricing structure depends on your deployment — talk to us about what fits your organization's shape.",
  },
];

export const comparisonMatrix = {
  categories: ["Platform", "Deployment", "Support"],
  rows: [
    { feature: "AI Chat", "self-hosted": true, managed: true, enterprise: true },
    { feature: "AI Agent + scheduled tasks", "self-hosted": true, managed: true, enterprise: true },
    { feature: "AI Code", "self-hosted": true, managed: true, enterprise: true },
    { feature: "Isolated per-user environments", "self-hosted": true, managed: true, enterprise: true },
    { feature: "Org admin controls & usage tracking", "self-hosted": true, managed: true, enterprise: true },
    { feature: "You operate the infrastructure", "self-hosted": true, managed: false, enterprise: false },
    { feature: "MONOLITH operates the infrastructure", "self-hosted": false, managed: true, enterprise: true },
    { feature: "Dedicated onboarding support", "self-hosted": false, managed: false, enterprise: true },
    { feature: "Priority support channel", "self-hosted": false, managed: false, enterprise: true },
  ],
} as const;
