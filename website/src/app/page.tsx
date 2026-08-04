import { Hero } from "@/components/home/hero";
import { ManifestoSection } from "@/components/home/manifesto-section";
import { ProductJourney } from "@/components/home/product-journey";
import { WhyPillars } from "@/components/home/why-pillars";
import { WorkflowExplainer } from "@/components/home/workflow-explainer";
import { DemoGallery } from "@/components/home/demo-gallery";
import { TrustSection } from "@/components/home/trust-section";
import { EcosystemDiagram } from "@/components/home/ecosystem-diagram";
import { EarlyAccess } from "@/components/home/early-access";
import { HomeFinalCta } from "@/components/home/final-cta";

export default function HomePage() {
  return (
    <>
      <Hero />
      <ManifestoSection />
      <ProductJourney />
      <WhyPillars />
      <WorkflowExplainer />
      <DemoGallery />
      <TrustSection />
      <EcosystemDiagram />
      <EarlyAccess />
      <HomeFinalCta />
    </>
  );
}
