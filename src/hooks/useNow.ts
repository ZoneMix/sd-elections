"use client";

import { useSyncExternalStore } from "react";

const TICK_MS = 30_000;

const subscribe = (onChange: () => void): (() => void) => {
  const id = setInterval(onChange, TICK_MS);
  return () => clearInterval(id);
};

// Floored to the tick so repeated reads within one tick are identical.
const snapshot = (): number => Math.floor(Date.now() / TICK_MS) * TICK_MS;

/**
 * Current time, refreshed every 30s. Null during prerender and hydration, so
 * time-dependent copy never mismatches the static HTML.
 */
export function useNow(): number | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}
