import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { ContentBlocks } from "@/components/marketing/content-blocks";
import { BlogCard } from "@/components/marketing/blog-card";
import { JsonLd } from "@/components/seo/json-ld";
import { blogPosts } from "@/content/blog";
import { site } from "@/content/site";

export function generateStaticParams() {
  return blogPosts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = blogPosts.find((p) => p.slug === slug);
  if (!post) return {};
  return { title: post.title, description: post.excerpt };
}

export default async function BlogArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = blogPosts.find((p) => p.slug === slug);
  if (!post) notFound();

  const related = blogPosts.filter((p) => p.slug !== post.slug).slice(0, 2);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: post.title,
          description: post.excerpt,
          datePublished: post.date,
          author: { "@type": "Organization", name: post.author },
          publisher: { "@type": "Organization", name: site.company },
          mainEntityOfPage: `${site.url}/blog/${post.slug}`,
        }}
      />
      <article className="py-16 md:py-24">
        <Container wide className="max-w-[720px]">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px] text-text-muted">
            <Link href="/blog" className="hover:text-text-primary">
              Blog
            </Link>
            <ChevronRight size={13} />
            <span className="text-text-secondary">{post.category}</span>
          </nav>

          <div className="mt-6 flex items-center gap-3 text-[12px] text-text-muted">
            <span className="font-mono uppercase tracking-[0.08em] text-accent">{post.category}</span>
            <span>·</span>
            <time>{post.date}</time>
            <span>·</span>
            <span>{post.readMinutes} min read</span>
          </div>
          <h1 className="mt-4 text-balance font-display text-[clamp(2.1rem,4.6vw,3.2rem)] leading-[1.06] text-text-primary">
            {post.title}
          </h1>
          <p className="mt-3 text-[13.5px] text-text-muted">By {post.author}</p>

          <div className="mt-10">
            <ContentBlocks blocks={post.content} />
          </div>
        </Container>
      </article>

      {related.length ? (
        <section className="border-t border-border-soft py-16">
          <Container>
            <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-muted">More from the blog</h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              {related.map((p) => (
                <BlogCard key={p.slug} post={p} />
              ))}
            </div>
          </Container>
        </section>
      ) : null}
    </>
  );
}
