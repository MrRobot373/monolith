"use client";

import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";

export function FaqAccordion({ items }: { items: { q: string; a: string }[] }) {
  return (
    <Accordion.Root type="single" collapsible className="flex flex-col divide-y divide-border-soft border-y border-border-soft">
      {items.map((item, i) => (
        <Accordion.Item key={item.q} value={`item-${i}`}>
          <Accordion.Header>
            <Accordion.Trigger className="group flex w-full items-center justify-between gap-4 py-5 text-left text-[15.5px] font-medium text-text-primary">
              {item.q}
              <ChevronDown size={17} className="shrink-0 text-text-muted transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="overflow-hidden text-[14.5px] leading-relaxed text-text-secondary data-[state=open]:animate-[accordionDown_0.2s_ease] data-[state=closed]:animate-[accordionUp_0.2s_ease]">
            <p className="pb-5 pr-8">{item.a}</p>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
