import {
  isLoopbackOpenworkServerUrl,
  normalizeOpenworkServerUrl,
  readOpenworkServerSettings,
} from "../../app/lib/openwork-server";
import { openworkServerInfo, type OpenworkServerInfo } from "../../app/lib/desktop";
import { isDesktopRuntime } from "../../app/utils";

export type OpenworkConnectionSource = "desktop-runtime" | "stored-settings" | "empty";

export type ResolvedOpenworkConnection = {
  normalizedBaseUrl: string;
  resolvedToken: string;
  resolvedHostToken: string;
  hostInfo: OpenworkServerInfo | null;
  source: OpenworkConnectionSource;
};

function hasUsableConnection(url: string, token: string) {
  return url.trim().length > 0 && token.trim().length > 0;
}

function readEnvOpenworkConnection() {
  const deployment = typeof import.meta.env?.VITE_OPENWORK_DEPLOYMENT === "string"
    ? import.meta.env.VITE_OPENWORK_DEPLOYMENT.trim()
    : "";
  const rawUrl = typeof import.meta.env?.VITE_OPENWORK_URL === "string"
    ? import.meta.env.VITE_OPENWORK_URL.trim()
    : "";
  const token = typeof import.meta.env?.VITE_OPENWORK_TOKEN === "string"
    ? import.meta.env.VITE_OPENWORK_TOKEN.trim()
    : "";
  const hostToken = typeof import.meta.env?.VITE_OPENWORK_HOST_TOKEN === "string"
    ? import.meta.env.VITE_OPENWORK_HOST_TOKEN.trim()
    : "";
  const normalizedBaseUrl = normalizeOpenworkServerUrl(rawUrl) ?? "";
  return deployment === "web" && hasUsableConnection(normalizedBaseUrl, token)
    ? { normalizedBaseUrl, token, hostToken }
    : null;
}

/**
 * Resolve the OpenWork server connection for routes that consume the server API.
 *
 * Local desktop-hosted servers expose ephemeral loopback ports and freshly
 * minted tokens on every boot, so live runtime info is the source of truth
 * there. Stored settings remain the fallback for remote/manual server
 * connections and for desktop cases where the runtime bridge is unavailable.
 */
export async function resolveOpenworkConnection(): Promise<ResolvedOpenworkConnection> {
  let staleDesktopRuntimeBaseUrl = "";

  if (!isDesktopRuntime()) {
    const envConnection = readEnvOpenworkConnection();
    if (envConnection) {
      return {
        normalizedBaseUrl: envConnection.normalizedBaseUrl,
        resolvedToken: envConnection.token,
        resolvedHostToken: isLoopbackOpenworkServerUrl(envConnection.normalizedBaseUrl)
          ? envConnection.hostToken
          : "",
        hostInfo: null,
        source: "stored-settings",
      };
    }
  }

  if (isDesktopRuntime()) {
    try {
      const info = await openworkServerInfo() as OpenworkServerInfo;
      const normalizedBaseUrl =
        normalizeOpenworkServerUrl(info.baseUrl ?? info.connectUrl ?? info.lanUrl ?? info.mdnsUrl ?? "") ??
        "";
      const resolvedToken = info.ownerToken?.trim() || info.clientToken?.trim() || "";
      if (info.running === true && hasUsableConnection(normalizedBaseUrl, resolvedToken)) {
        return {
          normalizedBaseUrl,
          resolvedToken,
          resolvedHostToken: info.hostToken?.trim() || "",
          hostInfo: info,
          source: "desktop-runtime",
        };
      }
      staleDesktopRuntimeBaseUrl = normalizedBaseUrl;
    } catch {
      // Fall through to stored settings for remote/manual connections.
    }
  }

  const settings = readOpenworkServerSettings();
  const normalizedBaseUrl = normalizeOpenworkServerUrl(settings.urlOverride ?? "") ?? "";
  const resolvedToken = settings.token?.trim() ?? "";
  const resolvedHostToken =
    normalizedBaseUrl && isLoopbackOpenworkServerUrl(normalizedBaseUrl)
      ? settings.hostToken?.trim() ?? ""
      : "";
  const storedConnectionIsStaleDesktopRuntime = Boolean(
    isDesktopRuntime() &&
      staleDesktopRuntimeBaseUrl &&
      normalizedBaseUrl === staleDesktopRuntimeBaseUrl,
  );
  const source =
    !storedConnectionIsStaleDesktopRuntime && hasUsableConnection(normalizedBaseUrl, resolvedToken)
      ? "stored-settings"
      : "empty";

  return {
    normalizedBaseUrl: source === "empty" ? "" : normalizedBaseUrl,
    resolvedToken: source === "empty" ? "" : resolvedToken,
    resolvedHostToken: source === "empty" ? "" : resolvedHostToken,
    hostInfo: null,
    source,
  };
}
