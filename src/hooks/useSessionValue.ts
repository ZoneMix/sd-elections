"use client";

import { useCallback, useSyncExternalStore } from "react";

// A string kept in sessionStorage only: it survives a reload but is cleared
// when the tab closes. Never localStorage or cookies. Storage can throw
// (private mode, blocked site data), so values also live in memory and the
// page works without storage.
const memory = new Map<string, string>();
const listeners = new Set<() => void>();

function read(key: string): string {
  try {
    return window.sessionStorage.getItem(key) ?? memory.get(key) ?? "";
  } catch {
    return memory.get(key) ?? "";
  }
}

function write(key: string, value: string): void {
  if (value) memory.set(key, value);
  else memory.delete(key);
  try {
    if (value) window.sessionStorage.setItem(key, value);
    else window.sessionStorage.removeItem(key);
  } catch {
    // Storage unavailable: the in-memory copy lasts for this page view.
  }
  listeners.forEach((fn) => fn());
}

const subscribe = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** [value, setValue]; empty string during prerender and when unset. */
export function useSessionValue(key: string): [string, (value: string) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => "",
  );
  const set = useCallback((v: string) => write(key, v), [key]);
  return [value, set];
}
