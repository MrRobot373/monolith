import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { BlogPost } from "@/content/blog";

export function BlogCard({ post, featured }: { post: BlogPost; featured?: boolean }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className={
        "group flex flex-col rounded-[20px] border border-border-soft bg-bg-elevated p-7 transition-colors hover:border-border-strong " +
        (featured ? "sm:col-span-2" : "")
      }
    >
      <div className="flex items-center gap-3 text-[11.5px] text-text-muted">
        <span className="font-mono uppercase tracking-[0.08em] text-accent">{post.category}</span>
        <span>·</span>
        <time>{post.date}</time>
        <span>·</span>
        <span>{post.readMinutes} min read</span>
      </div>
      <h3 className={"mt-3 font-display text-text-primary " + (featured ? "text-[28px] leading-[1.1]" : "text-[19px] leading-snug")}>
        {post.title}
      </h3>
      <p className="mt-2.5 max-w-[60ch] text-[14px] leading-relaxed text-text-secondary">{post.excerpt}</p>
      <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-text-primary">
        Read more
        <ArrowRight size={13} className="transition-transform duration-200 group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
