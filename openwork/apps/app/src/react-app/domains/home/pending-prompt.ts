/**
 * MONOLITH: the hub's search bar sends the typed question to the workspace as
 * `?q=<text>`. `index.react.tsx` stashes it here before React mounts (route
 * redirects strip the query string), and the home composer takes it on mount.
 *
 * Session-scoped on purpose: a reload should not re-prefill an old question.
 */
export const PENDING_PROMPT_KEY = "monolith.pendingPrompt";

/** Return the pending prompt and remove it, so it prefills exactly once. */
export function takePendingPrompt(): string {
  if (typeof window === "undefined") return "";
  try {
    const pending = window.sessionStorage.getItem(PENDING_PROMPT_KEY);
    if (!pending) return "";
    window.sessionStorage.removeItem(PENDING_PROMPT_KEY);
    return pending;
  } catch {
    return "";
  }
}
