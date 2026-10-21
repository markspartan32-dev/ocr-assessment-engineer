"use client";

import { useEffect } from "react";

/** Registers the offline service worker in production builds (dev keeps hot reload uncached). */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";
    navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(version)}`, { scope: "/", updateViaCache: "none" }).catch(() => {
      // Offline support is progressive: the app still works online without it.
    });
  }, []);
  return null;
}
