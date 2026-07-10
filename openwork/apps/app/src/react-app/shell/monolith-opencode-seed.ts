export async function seedLocalWorkspaceOpencodeConfig(folder: string | null | undefined) {
  const folderPath = folder?.trim();
  if (!folderPath || typeof fetch === "undefined") return false;
  try {
    const response = await fetch("/__monolith/seed-opencode-config", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ folderPath }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
