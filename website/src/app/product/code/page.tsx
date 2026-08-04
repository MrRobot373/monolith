import type { Metadata } from "next";
import { ProductDetailTemplate } from "@/components/marketing/product-detail-template";
import { products } from "@/content/products";

const product = products.find((p) => p.slug === "code")!;

export const metadata: Metadata = {
  title: product.name,
  description: product.description,
};

export default function CodeProductPage() {
  return <ProductDetailTemplate product={product} />;
}
