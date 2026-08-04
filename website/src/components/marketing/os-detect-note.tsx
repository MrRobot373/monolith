"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";

type Os = "windows" | "mac" | "linux" | "unknown";

function detectOs(): Os {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("win")) return "windows";
  if (ua.includes("mac")) return "mac";
  if (ua.includes("linux") || ua.includes("x11")) return "linux";
  return "unknown";
}

export function OsDetectNote() {
  const [os, setOs] = useState<Os | null>(null);

  useEffect(() => {
    // navigator is unavailable during SSR — this reads a real external API on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOs(detectOs());
  }, []);

  if (!os || os === "unknown") return null;

  return (
    <div className="mt-4 flex items-start gap-2.5 rounded-[12px] border border-border-soft bg-bg-secondary px-4 py-3 text-[13px] text-text-secondary">
      <Info size={15} className="mt-0.5 shrink-0 text-accent" />
      {os === "windows" ? (
        <span>
          Detected Windows — the native, no-Docker path (below) is supported and the fastest way
          to try MONOLITH on this machine.
        </span>
      ) : (
        <span>
          Detected {os === "mac" ? "macOS" : "Linux"} — the native launcher currently supports
          Windows only. Use the Self-Hosted (Docker) path below, which runs on any OS with Docker
          installed.
        </span>
      )}
    </div>
  );
}
