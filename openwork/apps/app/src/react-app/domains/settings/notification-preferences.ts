// MONOLITH notification preferences — what triggers an in-app notification-
// center entry and/or a browser push notification. Persisted to localStorage;
// read by session-page.tsx's background-task watcher and the scheduler UI.
import { useSyncExternalStore } from "react";

export type NotificationPrefs = {
  taskCompleted: boolean;
  needsInput: boolean;
  scheduledFailures: boolean;
  browserPush: boolean;
};

const STORAGE_KEY = "monolith.notification-prefs.v1";

const DEFAULT_PREFS: NotificationPrefs = {
  taskCompleted: true,
  needsInput: true,
  scheduledFailures: true,
  browserPush: false,
};

let cache: NotificationPrefs | null = null;
const listeners = new Set<() => void>();

function load(): NotificationPrefs {
  if (cache) return cache;
  if (typeof window === "undefined") return { ...DEFAULT_PREFS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<NotificationPrefs>) : {};
    cache = { ...DEFAULT_PREFS, ...parsed };
  } catch {
    cache = { ...DEFAULT_PREFS };
  }
  return cache;
}

function persist() {
  if (typeof window === "undefined" || !cache) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // ignore
  }
  listeners.forEach((listener) => listener());
}

export function getNotificationPrefs(): NotificationPrefs {
  return load();
}

export function setNotificationPref<K extends keyof NotificationPrefs>(key: K, value: NotificationPrefs[K]) {
  cache = { ...load(), [key]: value };
  persist();
}

export function useNotificationPrefs(): NotificationPrefs {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    load,
    () => DEFAULT_PREFS,
  );
}

/** Fires a native browser push notification if permitted and enabled. */
export function maybeSendBrowserPush(title: string, body?: string) {
  if (typeof window === "undefined" || typeof Notification === "undefined") return;
  if (!load().browserPush) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body });
  } catch {
    // ignore (e.g. no OS notification support)
  }
}

export async function requestBrowserPushPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || typeof Notification === "undefined") return "denied";
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
}
