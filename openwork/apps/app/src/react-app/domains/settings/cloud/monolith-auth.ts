/** @jsxImportSource react */
// MONOLITH account auth store — a thin wrapper around Supabase auth state,
// shared by the sidebar footer (account label) and the Account settings page
// (sign in / sign up / sign out). Replaces OpenWork's Den cloud-account hooks.
import { useCallback, useSyncExternalStore } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { getSupabaseClient, isSupabaseConfigured } from "@/app/lib/supabase";

type AuthStatus = "not-configured" | "loading" | "signed-out" | "signed-in";

type AuthState = {
  status: AuthStatus;
  user: User | null;
};

let state: AuthState = {
  status: isSupabaseConfigured() ? "loading" : "not-configured",
  user: null,
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

function setState(next: Partial<AuthState>) {
  state = { ...state, ...next };
  emit();
}

function sessionToState(session: Session | null): Partial<AuthState> {
  return session?.user
    ? { status: "signed-in", user: session.user }
    : { status: "signed-out", user: null };
}

let initialized = false;
function ensureInitialized() {
  if (initialized) return;
  initialized = true;
  const client = getSupabaseClient();
  if (!client) {
    setState({ status: "not-configured", user: null });
    return;
  }
  void client.auth.getSession().then(({ data }) => setState(sessionToState(data.session)));
  client.auth.onAuthStateChange((_event, session) => setState(sessionToState(session)));
}

const subscribe = (listener: () => void) => {
  ensureInitialized();
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = () => state;

export type MonolithAuthResult = { ok: true } | { ok: false; error: string };

export function useMonolithAuth() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const signInWithPassword = useCallback(async (email: string, password: string): Promise<MonolithAuthResult> => {
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: "Supabase is not configured." };
    const { error } = await client.auth.signInWithPassword({ email, password });
    return error ? { ok: false, error: error.message } : { ok: true };
  }, []);

  const signUpWithPassword = useCallback(async (email: string, password: string): Promise<MonolithAuthResult> => {
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: "Supabase is not configured." };
    const { error } = await client.auth.signUp({ email, password });
    return error ? { ok: false, error: error.message } : { ok: true };
  }, []);

  const signOut = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client) return;
    await client.auth.signOut();
  }, []);

  return {
    status: snapshot.status,
    user: snapshot.user,
    isConfigured: snapshot.status !== "not-configured",
    isSignedIn: snapshot.status === "signed-in",
    signInWithPassword,
    signUpWithPassword,
    signOut,
  };
}
