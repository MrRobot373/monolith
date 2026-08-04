import type { MetadataRoute } from "next";
import { site } from "@/content/site";
import { products } from "@/content/products";
import { useCases } from "@/content/use-cases";
import { blogPosts } from "@/content/blog";
import { docsPages } from "@/content/docs";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = [
    "",
    "/product",
    "/deployment",
    "/use-cases",
    "/pricing",
    "/download",
    "/docs",
    "/blog",
    "/changelog",
    "/releases",
    "/press",
    "/security",
    "/legal/privacy",
    "/legal/terms",
  ];

  const now = new Date();

  return [
    ...staticRoutes.map((path) => ({ url: `${site.url}${path}`, lastModified: now })),
    ...products.map((p) => ({ url: `${site.url}/product/${p.slug}`, lastModified: now })),
    ...useCases.map((u) => ({ url: `${site.url}/use-cases/${u.slug}`, lastModified: now })),
    ...blogPosts.map((b) => ({ url: `${site.url}/blog/${b.slug}`, lastModified: new Date(b.date) })),
    ...docsPages.map((d) => ({ url: `${site.url}/docs/${d.slug}`, lastModified: now })),
  ];
}
