// Detects an in-flight web-search tool call so the chat surface can show the
// more specific "searching" orb instead of the coarse thinking/responding
// one. Two tool names count as "web search": opencode's own built-in
// `websearch` tool, and MONOLITH's custom MCP tool `monolith-web_web_search`
// (see monolith-server/mcp-catalog.mjs) -- the model can end up calling
// either depending on which one it reaches for.
import type { DynamicToolUIPart, UIMessage } from "ai";

import { collectToolParts, isToolPartInFlight } from "@/lib/tool-activity";

const WEB_SEARCH_TOOL_NAMES = new Set(["websearch", "monolith-web_web_search"]);

function isWebSearchDynamicToolPart(part: DynamicToolUIPart): boolean {
  return WEB_SEARCH_TOOL_NAMES.has(part.toolName);
}

export function isWebSearchInFlight(messages: UIMessage[]): boolean {
  return collectToolParts(messages).some(
    (part) => isWebSearchDynamicToolPart(part) && isToolPartInFlight(part),
  );
}
