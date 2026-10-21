"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BookOpenCheck, CornerDownLeft, FileQuestion, Focus, Layers, PenLine, RotateCcw, Search, StickyNote } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type ComponentType, type KeyboardEvent } from "react";
import { UNITS } from "@/lib/content";
import { useUi } from "@/store/ui";
import { NAV_ITEMS } from "./nav";

interface PaletteItem {
  id: string;
  group: "Navigate" | "Units" | "Actions" | "Flashcards" | "Exam questions";
  label: string;
  hint?: string;
  keywords: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  run: () => void;
}

const GROUP_ORDER: PaletteItem["group"][] = ["Navigate", "Units", "Actions", "Flashcards", "Exam questions"];

const normalise = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s]/gu, " ");

/** Every query token must appear; label prefix matches rank first. */
function score(item: PaletteItem, tokens: string[]): number {
  const label = normalise(item.label);
  const haystack = `${label} ${normalise(item.keywords)}`;
  let total = 0;
  for (const token of tokens) {
    const at = haystack.indexOf(token);
    if (at === -1) return -1;
    total += label.startsWith(token) ? 3 : label.includes(token) ? 2 : 1;
  }
  return total;
}

export function CommandPalette() {
  const open = useUi((s) => s.paletteOpen);
  return <AnimatePresence>{open && <PalettePanel />}</AnimatePresence>;
}

/** Mounted only while open, so the query and selection start fresh each time. */
function PalettePanel() {
  const setOpen = useUi((s) => s.setPaletteOpen);
  const toggleFocus = useUi((s) => s.toggleFocusMode);
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const listId = useId();

  const baseItems = useMemo<PaletteItem[]>(() => {
    const go = (href: string) => () => router.push(href);
    const nav: PaletteItem[] = NAV_ITEMS.map((n) => ({ id: `nav-${n.href}`, group: "Navigate", label: n.label, keywords: n.short, icon: n.icon, run: go(n.href) }));
    const units: PaletteItem[] = UNITS.flatMap((u) => [
      { id: `review-${u.code}`, group: "Units" as const, label: `Review ${u.code}: ${u.title}`, keywords: `flashcards srs ${u.code}`, icon: BookOpenCheck, run: go(`/review/${u.code}`) },
      { id: `exam-${u.code}`, group: "Units" as const, label: `Exam practice ${u.code}: ${u.title}`, keywords: `questions mark scheme ${u.code}`, icon: PenLine, run: go(`/exam/${u.code}`) },
      { id: `unit-${u.code}`, group: "Units" as const, label: `Open unit ${u.code}: ${u.title}`, keywords: `topic areas ${u.code} ${u.assessment}`, icon: Layers, run: go(`/units/${u.code}`) },
    ]);
    const actions: PaletteItem[] = [
      { id: "focus", group: "Actions", label: "Toggle Focus mode", hint: "⇧F", keywords: "distraction free zen", icon: Focus, run: toggleFocus },
      { id: "reset", group: "Actions", label: "Reset progress…", keywords: "clear demo wipe start again", icon: RotateCcw, run: go("/settings#reset") },
    ];
    return [...nav, ...units, ...actions];
  }, [router, toggleFocus]);

  const contentItems = useMemo<PaletteItem[]>(() => {
    const go = (href: string) => () => router.push(href);
    return UNITS.flatMap((u) => [
        ...u.flashcards.map((c) => ({
          id: c.id,
          group: "Flashcards" as const,
          label: c.front,
          hint: u.code,
          keywords: `${c.keyTerms.join(" ")} ${c.back} ${u.code}`,
          icon: StickyNote,
          run: go(`/units/${u.code}#${c.id}`),
        })),
        ...u.questions.map((q) => ({
          id: q.id,
          group: "Exam questions" as const,
          label: q.question,
          hint: `${u.code} · ${q.marks}m`,
          keywords: `${q.commandWord} ${q.context ?? ""} ${u.code}`,
          icon: FileQuestion,
          run: go(`/exam/${u.code}#${q.id}`),
        })),
      ]);
  }, [router]);

  const results = useMemo(() => {
    const tokens = normalise(query).split(/\s+/).filter(Boolean);
    if (!tokens.length) return baseItems.filter((i) => i.group !== "Units").concat(baseItems.filter((i) => i.group === "Units").slice(0, 6));
    const ranked = [...baseItems, ...(query.trim().length >= 2 ? contentItems : [])]
      .map((item) => ({ item, s: score(item, tokens) }))
      .filter((r) => r.s >= 0)
      .sort((a, b) => b.s - a.s);
    const perGroup = new Map<string, number>();
    return ranked
      .filter(({ item }) => {
        const n = perGroup.get(item.group) ?? 0;
        perGroup.set(item.group, n + 1);
        return n < 6;
      })
      .map((r) => r.item)
      // Results are shown in labelled groups, so keep each group contiguous (the sort is stable).
      .sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group));
  }, [query, baseItems, contentItems]);

  const groups = useMemo(() => {
    const map = new Map<PaletteItem["group"], { item: PaletteItem; index: number }[]>();
    results.forEach((item, index) => map.set(item.group, [...(map.get(item.group) ?? []), { item, index }]));
    return [...map];
  }, [results]);

  // Focus the search box on open. On close, hand focus back to whatever opened the palette,
  // unless the chosen command has already put focus somewhere meaningful (e.g. a dialog).
  useEffect(() => {
    const returnFocus = document.activeElement as HTMLElement | null;
    const node = panel.current;
    const frame = requestAnimationFrame(() => input.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      const now = document.activeElement;
      const lost = !now || now === document.body || Boolean(node?.contains(now));
      if (lost && returnFocus?.isConnected) returnFocus.focus();
    };
  }, []);

  useEffect(() => {
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const run = (item: PaletteItem | undefined) => {
    if (!item) return;
    setOpen(false);
    item.run();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(results.length - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      run(results[active]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    } else if (event.key === "Tab") {
      // Focus stays in the search box; the list is navigated with the arrow keys.
      event.preventDefault();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]">
      <motion.div aria-hidden="true" className="absolute inset-0 bg-black/70 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="card relative w-full max-w-xl overflow-hidden shadow-2xl shadow-black/60"
        initial={{ opacity: 0, y: -12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 500, damping: 35 }}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search aria-hidden="true" className="size-4 text-fg-subtle" />
          <input
            ref={input}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            role="combobox"
            aria-label="Search commands, units, flashcards and questions"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={results[active] ? `${listId}-${results[active].id}` : undefined}
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
            placeholder="Search units, flashcards, questions…"
            className="h-14 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-subtle"
          />
          <span className="kbd">Esc</span>
        </div>
        <div ref={list} id={listId} role="listbox" aria-label="Results" className="max-h-[55vh] overflow-y-auto p-2 empty:hidden">
          {groups.map(([group, entries]) => (
            <div key={group} role="group" aria-labelledby={`${listId}-${group.replace(/\s+/g, "-")}`}>
              <div id={`${listId}-${group.replace(/\s+/g, "-")}`} className="eyebrow px-3 pb-1 pt-3">
                {group}
              </div>
              {entries.map(({ item, index }) => {
                const Icon = item.icon;
                const selected = index === active;
                return (
                  <div
                    key={item.id}
                    id={`${listId}-${item.id}`}
                    role="option"
                    aria-selected={selected}
                    data-index={index}
                    onMouseMove={() => setActive(index)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => run(item)}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${selected ? "bg-accent/15 text-fg" : "text-fg-muted"}`}
                  >
                    <Icon aria-hidden={true} className={`size-4 shrink-0 ${selected ? "text-accent" : ""}`} />
                    <span className="line-clamp-1 flex-1">{item.label}</span>
                    {item.hint && <span className="shrink-0 font-mono text-xs text-fg-subtle">{item.hint}</span>}
                    {selected && <CornerDownLeft aria-hidden="true" className="size-3.5 shrink-0 text-fg-subtle" />}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        {results.length === 0 && <p className="px-3 py-8 text-center text-sm text-fg-muted">No matches for “{query}”.</p>}
        <div role="status" className="sr-only">
          {query ? (results.length ? `${results.length} result${results.length === 1 ? "" : "s"}` : "No matches") : ""}
        </div>
        <div className="flex items-center gap-4 border-t border-line px-4 py-2 text-xs text-fg-subtle">
          <span><span className="kbd">↑</span> <span className="kbd">↓</span> move</span>
          <span><span className="kbd">↵</span> open</span>
          <span aria-hidden="true" className="ml-auto">
            {results.length} result{results.length === 1 ? "" : "s"}
          </span>
        </div>
      </motion.div>
    </div>
  );
}
