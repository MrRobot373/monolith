export function normalizeWorkspaceFolderPath(value: string | null | undefined) {
  let next = value?.trim() ?? "";
  if (!next) return "";

  next = next.replace(/^[`'"]+/, "").replace(/[`'"]+$/, "").trim();

  if (/^file:\/\//i.test(next)) {
    try {
      const url = new URL(next);
      next = decodeURIComponent(url.pathname);
      if (/^\/[A-Za-z]:\//.test(next)) next = next.slice(1);
      next = next.replace(/\//g, "\\");
    } catch {
      // Keep the original text if it was not a valid file URL.
    }
  }

  return next;
}
