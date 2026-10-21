"use client";

import { useUi } from "@/store/ui";

export function LiveAnnouncer() {
  const message = useUi((s) => s.announcement);
  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
}
