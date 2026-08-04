import type { Metadata } from "next";
import { ProductDetailTemplate } from "@/components/marketing/product-detail-template";
import { products } from "@/content/products";

const product = products.find((p) => p.slug === "agent")!;

export const metadata: Metadata = {
  title: product.name,
  description: product.description,
};

export default function AgentProductPage() {
  return <ProductDetailTemplate product={product} />;
}
