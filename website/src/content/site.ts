export const site = {
  name: "MONOLITH",
  company: "GetMySolution",
  tagline: "Private AI, run on your terms.",
  description:
    "MONOLITH is a private AI workspace — chat, agents, and a coding assistant — that runs on your infrastructure or ours, and never trains on your data.",
  url: "https://monolith.example.com",
};

export const primaryNav = [
  { label: "Product", href: "/product" },
  { label: "Deployment", href: "/deployment" },
  { label: "Use cases", href: "/use-cases" },
  { label: "Pricing", href: "/pricing" },
  { label: "Docs", href: "/docs" },
] as const;

export const resourcesMenu = [
  { label: "Blog", href: "/blog", description: "Notes on how the platform is built and why." },
  { label: "Changelog", href: "/changelog", description: "What shipped, and when." },
  { label: "Security", href: "/security", description: "The architecture behind the privacy guarantee." },
  { label: "Press", href: "/press", description: "Company boilerplate and brand assets." },
] as const;

export const footerLinks = {
  Product: [
    { label: "Overview", href: "/product" },
    { label: "Chat", href: "/product/chat" },
    { label: "Agent", href: "/product/agent" },
    { label: "Code", href: "/product/code" },
    { label: "Deployment", href: "/deployment" },
  ],
  Resources: [
    { label: "Use cases", href: "/use-cases" },
    { label: "Docs", href: "/docs" },
    { label: "Blog", href: "/blog" },
    { label: "Changelog", href: "/changelog" },
    { label: "Releases", href: "/releases" },
  ],
  Company: [
    { label: "Pricing", href: "/pricing" },
    { label: "Security", href: "/security" },
    { label: "Press", href: "/press" },
    { label: "Try the demo", href: "/app" },
  ],
  Legal: [
    { label: "Privacy", href: "/legal/privacy" },
    { label: "Terms", href: "/legal/terms" },
  ],
} as const;
