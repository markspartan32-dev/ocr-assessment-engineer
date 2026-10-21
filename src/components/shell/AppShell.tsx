"use client";

import { Command, Focus, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useUi } from "@/store/ui";
import { PlayerStats } from "@/components/stats/PlayerStats";
import { ConnectivityPill } from "./ConnectivityPill";
import { MobileLinks, SidebarLinks } from "./NavLinks";

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-lg" aria-label="DataCommand home">
      <svg viewBox="0 0 512 512" className="size-8" aria-hidden="true">
        <rect width="512" height="512" rx="112" fill="#141c30" />
        <path d="M136 168 L232 256 L136 344" fill="none" stroke="#7cb2ff" strokeWidth="44" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="268" y="296" width="44" height="64" rx="12" fill="#5b9dff" />
        <rect x="328" y="236" width="44" height="124" rx="12" fill="#a78bfa" />
        <rect x="388" y="168" width="44" height="192" rx="12" fill="#f5b83d" />
      </svg>
      <span className="text-base font-semibold tracking-tight">
        Data<span className="text-accent">Command</span>
      </span>
    </Link>
  );
}

function FocusTimer() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return (
    <span className="font-mono text-sm tabular-nums text-fg-muted" aria-label={`Focus session time ${Math.floor(seconds / 60)} minutes ${seconds % 60} seconds`} role="timer">
      {mm}:{ss}
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const focusMode = useUi((s) => s.focusMode);
  const setFocusMode = useUi((s) => s.setFocusMode);
  const setPaletteOpen = useUi((s) => s.setPaletteOpen);

  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="sr-only z-50 rounded-lg bg-accent px-4 py-2 font-semibold text-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>

      {!focusMode && (
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface/60 px-4 py-5 backdrop-blur lg:flex">
          <Logo />
          <nav aria-label="Main" className="mt-8">
            <SidebarLinks />
          </nav>
          <div className="mt-auto space-y-3">
            <button type="button" onClick={() => setFocusMode(true)} className="btn btn-ghost w-full justify-between">
              <span className="flex items-center gap-2">
                <Focus aria-hidden="true" className="size-4" /> Focus mode
              </span>
              <span className="kbd">⇧F</span>
            </button>
            <p className="px-1 text-xs leading-5 text-fg-subtle">
              OCR Level 3 Cambridge Advanced National in IT: Data Analytics (H019/H119)
            </p>
          </div>
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {focusMode ? (
          <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line/60 bg-canvas/80 px-4 py-3 backdrop-blur sm:px-6">
            <span className="flex items-center gap-2 text-sm font-medium text-fg-muted">
              <Focus aria-hidden="true" className="size-4 text-accent" /> Focus mode
            </span>
            <FocusTimer />
            <button type="button" onClick={() => setFocusMode(false)} className="btn btn-ghost px-3 py-1.5">
              <X aria-hidden="true" className="size-4" /> Exit <span className="kbd hidden sm:inline-flex">Esc</span>
            </button>
          </div>
        ) : (
          <header className="sticky top-0 z-30 border-b border-line/60 bg-canvas/75 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
              <div className="lg:hidden">
                <Logo />
              </div>
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className="hidden flex-1 items-center gap-3 rounded-xl border border-line-strong bg-surface-2 px-3 py-2 text-left text-sm text-fg-subtle transition-colors hover:border-accent/50 hover:text-fg-muted md:flex md:max-w-sm"
              >
                <Command aria-hidden="true" className="size-4" />
                <span className="flex-1">Search cards, jump to a unit…</span>
                <span className="kbd">⌘K</span>
              </button>
              <button type="button" onClick={() => setPaletteOpen(true)} aria-label="Open command palette" className="btn btn-ghost p-2 md:hidden">
                <Command aria-hidden="true" className="size-4" />
              </button>
              <div className="ml-auto flex items-center gap-2">
                <ConnectivityPill />
                <PlayerStats />
              </div>
            </div>
          </header>
        )}

        <main id="main" tabIndex={-1} className={`mx-auto w-full flex-1 px-4 pb-28 pt-6 outline-none sm:px-6 lg:pb-12 ${focusMode ? "max-w-3xl" : "max-w-6xl"}`}>
          {children}
        </main>
      </div>

      {!focusMode && (
        <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
          <MobileLinks />
        </nav>
      )}
    </div>
  );
}
