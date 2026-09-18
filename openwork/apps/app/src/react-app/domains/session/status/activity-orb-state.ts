// Maps MONOLITH's own session activity states to thinking-orbs' animation
// states + tuned speeds, so every "the agent is busy" indicator in the chat
// surface uses the same visual language. "idle" has no mapping on purpose —
// nothing is happening, so no orb is shown (unchanged from before).
import type { OrbState } from "thinking-orbs";

import type { SessionActivityStatus } from "./session-activity-store";

export type OrbPreset = { state: OrbState; speed: number };

const ACTIVITY_ORB_PRESET: Partial<Record<SessionActivityStatus, OrbPreset>> = {
  thinking: { state: "solving", speed: 0.6 }, // reasoning before any output
  responding: { state: "listening", speed: 1.55 }, // actively streaming the reply
  waiting: { state: "connecting", speed: 1.4 }, // waiting on the user (permission/question)
  compacting: { state: "weaving", speed: 3.0 }, // background housekeeping
  error: { state: "shaping", speed: 3.0 },
  // idle: intentionally absent -> no orb.
};

// Overrides the status-based preset above whenever a web-search tool call is
// actually in flight (see isWebSearchInFlight) -- more specific than the
// coarse thinking/responding split.
export const WEB_SEARCH_ORB_PRESET: OrbPreset = { state: "searching", speed: 0.6 };

export function activityStatusToOrbPreset(status: SessionActivityStatus): OrbPreset | null {
  return ACTIVITY_ORB_PRESET[status] ?? null;
}
