import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { SectionLabel } from "@/components/ui/section-label";
import { BlogCard } from "@/components/marketing/blog-card";
import { blogPosts } from "@/content/blog";

export const metadata: Metadata = {
  title: "Blog",
  description: "Notes on how MONOLITH is actually built, and why.",
};

export default function BlogIndexPage() {
  const [featured, ...rest] = blogPosts;

  return (
    <section className="py-16 md:py-24">
      <Container>
        <SectionLabel>Blog</SectionLabel>
        <h1 className="mt-4 max-w-[24ch] text-balance font-display text-[clamp(2rem,4.6vw,3.2rem)] leading-[1.05]">
          Notes on how this is actually built.
        </h1>

        <div className="mt-14 grid gap-5 sm:grid-cols-2">
          {featured ? <BlogCard post={featured} featured /> : null}
          {rest.map((post) => (
            <BlogCard key={post.slug} post={post} />
          ))}
        </div>
      </Container>
    </section>
  );
}
