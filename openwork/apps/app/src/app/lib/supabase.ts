// MONOLITH account auth: a thin Supabase client, configured entirely through
// build-time env vars. Replaces OpenWork's "Den" cloud-account system for this
// product.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type MonolithRuntimeConfig = {
  supabaseUrl?: string;
  supabasePublishableKey?: string;
  supabaseAnonKey?: string;
  requireSignin?: string;
};

function readRuntimeConfig(): MonolithRuntimeConfig {
  if (typeof window === "undefined") return {};
  return (
    (window as Window & { __MONOLITH_RUNTIME_CONFIG__?: MonolithRuntimeConfig })
      .__MONOLITH_RUNTIME_CONFIG__ ?? {}
  );
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

const runtimeConfig = readRuntimeConfig();
const SUPABASE_URL = readString(runtimeConfig.supabaseUrl) || readString(import.meta.env.VITE_SUPABASE_URL);
const SUPABASE_PUBLIC_KEY =
  readString(runtimeConfig.supabasePublishableKey) ||
  readString(runtimeConfig.supabaseAnonKey) ||
  readString(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) ||
  readString(import.meta.env.VITE_SUPABASE_ANON_KEY);
const REQUIRE_SIGNIN =
  readString(runtimeConfig.requireSignin) || readString(import.meta.env.VITE_MONOLITH_REQUIRE_SIGNIN);

function readBooleanFlag(value: string, fallback: boolean) {
  if (!value) return fallback;
  if (/^(1|true|yes|on|required)$/i.test(value)) return true;
  if (/^(0|false|no|off|optional)$/i.test(value)) return false;
  return fallback;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_PUBLIC_KEY);
}

export function isMonolithSignInRequired(): boolean {
  return readBooleanFlag(REQUIRE_SIGNIN, isSupabaseConfigured());
}

let client: SupabaseClient | null = null;

/** Returns the shared Supabase client, or null if VITE_SUPABASE_* isn't set. */
export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}

export async function getSupabaseAccessToken(): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session?.access_token ?? null;
}
