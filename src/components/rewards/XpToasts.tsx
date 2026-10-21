"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useEffect } from "react";
import { useUi, type XpToast } from "@/store/ui";

function Toast({ toast }: { toast: XpToast }) {
  const drop = useUi((s) => s.dropToast);
  useEffect(() => {
    const timer = window.setTimeout(() => drop(toast.id), 2400);
    return () => window.clearTimeout(timer);
  }, [drop, toast.id]);
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 12, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className="flex items-center gap-2 rounded-full border border-xp/40 bg-surface-2/95 py-1.5 pl-2 pr-3.5 shadow-lg shadow-black/40 backdrop-blur"
    >
      <span className="grid size-6 place-items-center rounded-full bg-xp/20">
        <Sparkles aria-hidden="true" className="size-3.5 text-xp" />
      </span>
      <span className="font-mono text-sm font-bold text-xp">+{toast.amount} XP</span>
      <span className="max-w-48 truncate text-xs text-fg-muted">{toast.label}</span>
    </motion.li>
  );
}

/** Floating "+XP" feedback. Screen readers get the same message via the live region. */
export function XpToasts() {
  const toasts = useUi((s) => s.toasts);
  return (
    <ul aria-hidden="true" className="pointer-events-none fixed right-4 top-20 z-40 flex flex-col items-end gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} />
        ))}
      </AnimatePresence>
    </ul>
  );
}
