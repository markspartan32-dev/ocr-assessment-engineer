"use client";

import { useSyncExternalStore } from "react";
import { toDayKey, type DayKey } from "@/lib/date";

function subscribe(onChange: () => void) {
  // Re-check every minute and on tab focus, so "today" rolls over at midnight.
  const timer = window.setInterval(onChange, 60_000);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", onChange);
  };
}

/** The student's local calendar day, or null during server rendering. */
export function useToday(): DayKey | null {
  return useSyncExternalStore(subscribe, () => toDayKey(), () => null);
}
