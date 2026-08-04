import { getSupabaseAccessToken, isMonolithSignInRequired } from "./supabase";

export async function monolithFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const token = await getSupabaseAccessToken();

  if (token && !headers.has("authorization")) {
    headers.set("authorization", `Bearer ${token}`);
  } else if (isMonolithSignInRequired()) {
    throw new Error("Sign in to MONOLITH to continue.");
  }

  return fetch(input, { ...init, headers });
}

export async function monolithJson<T>(input: RequestInfo | URL, init: RequestInit = {}): Promise<T> {
  const response = await monolithFetch(input, init);
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error || `${response.status}`);
  }
  return response.json() as Promise<T>;
}
