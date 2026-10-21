"use client";

import { WifiOff } from "lucide-react";
import { useOffline } from "next/offline";
import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function ConnectivityPill() {
  // Next's useOffline also catches failed requests on a connected-but-dead network; navigator.onLine
  // covers a page that the service worker loaded while the device was already offline.
  const nextOffline = useOffline();
  const browserOffline = useSyncExternalStore(subscribe, () => !navigator.onLine, () => false);
  const offline = nextOffline || browserOffline;
  // The status region stays mounted so the change is announced; only its content toggles.
  return (
    <div role="status">
      {offline && (
        <span className="flex items-center gap-1.5 rounded-full border border-xp/40 bg-xp/10 px-2.5 py-1 text-xs font-medium text-xp">
          <WifiOff aria-hidden="true" className="size-3.5" />
          <span>Offline<span className="hidden sm:inline"> · progress saved on this device</span></span>
        </span>
      )}
    </div>
  );
}
