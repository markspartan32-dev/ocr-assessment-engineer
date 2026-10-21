"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Trophy } from "lucide-react";
import { useEffect, useRef } from "react";
import { levelTitle, xpForLevel } from "@/lib/gamification";
import { useUi } from "@/store/ui";

const SPARKS = Array.from({ length: 18 }, (_, i) => {
  const angle = (i / 18) * Math.PI * 2;
  return { x: Math.cos(angle), y: Math.sin(angle), color: ["#5b9dff", "#a78bfa", "#f5b83d"][i % 3], delay: (i % 6) * 0.03 };
});

export function LevelUpOverlay() {
  const level = useUi((s) => s.levelUp);
  const dismiss = useUi((s) => s.dismissLevelUp);
  const announce = useUi((s) => s.announce);
  const button = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (level === null) return;
    announce(`Level up! You reached level ${level}: ${levelTitle(level)}.`);
    const previous = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => button.current?.focus(), 50);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        dismiss();
      } else if (event.key === "Tab") {
        event.preventDefault();
        button.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey, true);
      // The grade button that triggered the level-up has usually unmounted by now, so fall back
      // to the visible flashcard face, then to <main>.
      const fallback = document.querySelector<HTMLElement>("[data-focus-return]:not([inert])") ?? document.getElementById("main");
      (previous?.isConnected ? previous : fallback)?.focus({ preventScroll: true });
    };
  }, [level, dismiss, announce]);

  return (
    <AnimatePresence>
      {level !== null && (
        <div className="fixed inset-0 z-[60] grid place-items-center p-4">
          <motion.div aria-hidden="true" className="absolute inset-0 bg-black/75 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15 } }} onClick={dismiss} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="level-up-title"
            aria-describedby="level-up-description"
            className="card relative w-full max-w-sm overflow-hidden px-8 pb-8 pt-10 text-center shadow-2xl"
            initial={{ opacity: 0, scale: 0.6, rotate: reduce ? 0 : -6 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
          >
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgb(245_184_61/0.25),transparent_60%)]" />
            <div className="relative mx-auto grid size-24 place-items-center">
              {!reduce &&
                SPARKS.map((s, i) => (
                  <motion.span
                    key={i}
                    aria-hidden="true"
                    className="absolute size-2 rounded-full"
                    style={{ backgroundColor: s.color }}
                    initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                    animate={{ x: s.x * 110, y: s.y * 110, opacity: 0, scale: 0.4 }}
                    transition={{ duration: 1.1, delay: 0.15 + s.delay, ease: "easeOut" }}
                  />
                ))}
              <motion.div
                className="grid size-24 place-items-center rounded-3xl bg-gradient-to-br from-xp to-[#e0862b] shadow-lg shadow-xp/30"
                initial={{ y: 20 }}
                animate={{ y: reduce ? 0 : [20, -6, 0] }}
                transition={{ duration: 0.6, delay: 0.1 }}
              >
                <Trophy aria-hidden="true" className="size-11 text-ink" />
              </motion.div>
            </div>
            <p className="eyebrow relative mt-6 text-xp">Level up</p>
            <h2 id="level-up-title" className="relative mt-2 text-3xl font-bold tracking-tight">
              Level {level}
            </h2>
            <p id="level-up-description" className="relative mt-2 text-sm leading-6 text-fg-muted">
              You are now a <span className="font-semibold text-fg">{levelTitle(level)}</span>. Next level at {xpForLevel(level + 1).toLocaleString("en-GB")} XP.
            </p>
            <button ref={button} type="button" onClick={dismiss} className="btn btn-primary relative mt-6 w-full">
              Keep going
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
