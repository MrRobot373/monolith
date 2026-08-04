// Parses a `data: {...}\n\n` SSE stream from a fetch Response body, invoking
// onEvent for each decoded JSON event. The MONOLITH chat backend
// (monolith-server/chat.mjs) streams JSON-lines SSE; there is no EventSource
// here because we POST the request body, which EventSource can't do.

export async function parseSseStream(
  response: Response,
  onEvent: (event: Record<string, unknown>) => void,
): Promise<void> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        onEvent(JSON.parse(data) as Record<string, unknown>);
      } catch {
        // ignore malformed frame
      }
    }
  }
}
