"use client";

import { useState } from "react";
import { Search, Send } from "lucide-react";
import { ApprovalCard } from "./approval-card";
import { cn } from "@/lib/utils";

const modes = ["Chat", "Cowork", "Code"] as const;
type Mode = (typeof modes)[number];

type Message = { id: string; from: "user" | "agent"; text: string; tool?: string };

const initialMessages: Message[] = [
  { id: "m1", from: "user", text: "Summarize what changed in the pricing research this week." },
  { id: "m2", from: "agent", text: "Reading workspace context and searching 6 sources on the self-hosted index…", tool: "search" },
  { id: "m3", from: "agent", text: "Draft ready in competitive-notes.md — three material changes found, all cited." },
];

export function DispatchView() {
  const [mode, setMode] = useState<Mode>("Cowork");
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    const userMsg: Message = { id: `u-${Date.now()}`, from: "user", text: input.trim() };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    window.setTimeout(() => {
      setMessages((m) => [
        ...m,
        {
          id: `a-${Date.now()}`,
          from: "agent",
          text: "Got it — reading the relevant workspace files now. This is a static demo response, not a live model.",
        },
      ]);
    }, 500);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-1 border-b border-border-soft pb-3">
        {modes.map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "rounded-[8px] px-3.5 py-1.5 text-[13px] font-medium transition-colors",
              mode === m ? "bg-accent-soft text-accent-hover" : "text-text-secondary hover:bg-bg-secondary",
            )}
          >
            {m}
          </button>
        ))}
        <span className="ml-auto hidden font-mono text-[11px] text-text-muted sm:inline">Dispatch · Research workspace</span>
      </div>

      <div className="flex-1 overflow-y-auto py-5">
        <div className="flex flex-col gap-4">
          {messages.map((msg) => (
            <div key={msg.id} className={cn("flex", msg.from === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[80%] rounded-[14px] px-4 py-2.5 text-[13.5px] leading-relaxed",
                  msg.from === "user" ? "bg-text-primary text-bg-primary" : "bg-bg-secondary text-text-primary",
                )}
              >
                {msg.tool ? (
                  <span className="mb-1 flex items-center gap-1.5 text-[11px] text-accent">
                    <Search size={11} /> tool call
                  </span>
                ) : null}
                {msg.text}
              </div>
            </div>
          ))}
          <ApprovalCard />
        </div>
      </div>

      <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-border-soft pt-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Message in ${mode} mode…`}
          className="flex-1 rounded-[10px] border border-border-soft bg-bg-elevated px-3.5 py-2.5 text-[13.5px] text-text-primary outline-none placeholder:text-text-muted focus:border-accent"
        />
        <button
          type="submit"
          aria-label="Send"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-accent text-on-accent hover:bg-accent-hover"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
