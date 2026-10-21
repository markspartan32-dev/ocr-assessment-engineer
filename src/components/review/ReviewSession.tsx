"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, BookOpenCheck, CheckCircle2, Dumbbell, PenLine, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CARD_INDEX, UNITS, getUnit } from "@/lib/content";
import type { UnitCode } from "@/lib/content-types";
import { addDays } from "@/lib/date";
import { focusIsLost, isInteractiveTarget } from "@/lib/dom";
import { buildPracticeQueue, dueForecast, requeueAfter, type QueueItem } from "@/lib/srs/scheduler";
import { QUALITY_LABELS, type Quality } from "@/lib/srs/sm2";
import { useQueue, useStudyReady } from "@/hooks/useStudy";
import { useProgress } from "@/store/progress";
import { celebrate, useUi } from "@/store/ui";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Flashcard3D } from "./Flashcard3D";
import { GradeBar } from "./GradeBar";

interface Graded {
  cardId: string;
  q: Quality;
  xp: number;
  correct: boolean;
}

interface Session {
  mode: "scheduled" | "practice";
  items: QueueItem[];
  index: number;
  revealed: boolean;
  graded: Graded[];
}

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/** A view heading that takes focus when it replaces the control the student was using. */
function FocusHeading({ active, className, children }: { active: boolean; className: string; children: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (active && focusIsLost()) ref.current?.focus();
  }, [active]);
  return (
    <h2 ref={ref} tabIndex={-1} className={`outline-none ${className}`}>
      {children}
    </h2>
  );
}

function UnitFilter({ current }: { current?: UnitCode }) {
  const chip = (href: string, label: string, active: boolean) => (
    <Link
      key={href}
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-full border px-3 py-1 font-mono text-xs font-semibold transition-colors ${active ? "border-accent/50 bg-accent/15 text-accent" : "border-line-strong text-fg-muted hover:text-fg"}`}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="Choose unit" className="flex flex-wrap gap-2">
      {chip("/review", "ALL", !current)}
      {UNITS.map((u) => chip(`/review/${u.code}`, u.code, current === u.code))}
    </nav>
  );
}

export function ReviewSession({ unitCode }: { unitCode?: UnitCode }) {
  const today = useStudyReady();
  const unit = unitCode ? getUnit(unitCode) : undefined;
  const cardIds = useMemo(() => (unit ? unit.flashcards : UNITS.flatMap((u) => u.flashcards)).map((c) => c.id), [unit]);
  const queue = useQueue(cardIds, today);
  const cards = useProgress((s) => s.cards);
  const focusMode = useUi((s) => s.focusMode);
  const shortcuts = useProgress((s) => s.settings.shortcuts);
  const root = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState<Session | null>(null);
  /** Set once the student acts, so views it causes may take focus (never on first page load). */
  const [interacted, setInteracted] = useState(false);
  // Until the first interaction the session mirrors the live queue; the first reveal freezes it,
  // so grading cards never reshuffles the session in progress.
  const session = useMemo<Session | null>(
    () => started ?? (queue ? { mode: "scheduled", items: queue.items, index: 0, revealed: false, graded: [] } : null),
    [started, queue],
  );
  const setSession = useCallback(
    (next: Session | null | ((s: Session) => Session)) => setStarted(typeof next === "function" ? (prev) => next(prev ?? session!) : next),
    [session],
  );

  const current = session && session.index < session.items.length ? session.items[session.index] : null;
  const entry = current ? CARD_INDEX.get(current.cardId) : undefined;

  const reveal = useCallback(() => {
    setInteracted(true);
    setSession((s) => ({ ...s, revealed: true }));
  }, [setSession]);

  const grade = useCallback(
    (q: Quality) => {
      if (!session || !current || !entry || !session.revealed) return;
      setInteracted(true);
      const result = useProgress.getState().gradeCard(current.cardId, q, new Date(), session.mode === "practice");
      const progress = useProgress.getState().cards[current.cardId];
      const changes = progress && (result.kind === "new" || result.kind === "review");
      const next = changes ? `next review in ${progress.interval} day${progress.interval === 1 ? "" : "s"}` : "schedule unchanged";
      const label = `${QUALITY_LABELS[q].label} · ${next}`;
      if (result.xp > 0) celebrate(result, label);
      else useUi.getState().announce(`${label}.${result.requeue ? " This card will come back later in this session." : ""}`);
      setSession((s) => ({
        ...s,
        items: result.requeue ? requeueAfter(s.items, s.index, current) : s.items,
        index: s.index + 1,
        revealed: false,
        graded: [...s.graded, { cardId: current.cardId, q, xp: result.xp, correct: result.correct }],
      }));
    },
    [session, current, entry, setSession],
  );

  // Space/Enter reveal and 0–5 grade, but only when focus is in the session (or nowhere), never
  // on a link or button that owns those keys. Digits can be turned off in Settings (WCAG 2.1.4).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target) || isInteractiveTarget(event.target)) return;
      if (useUi.getState().paletteOpen || useUi.getState().levelUp !== null) return;
      const inSession = event.target === document.body || (event.target instanceof Node && root.current?.contains(event.target));
      if (!inSession || !current) return;
      if (!session?.revealed && (event.key === " " || event.key === "Enter")) {
        event.preventDefault();
        reveal();
      } else if (session?.revealed && shortcuts && /^[0-5]$/.test(event.key)) {
        event.preventDefault();
        grade(Number(event.key) as Quality);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [session?.revealed, current, reveal, grade, shortcuts]);

  const practise = () => {
    setInteracted(true);
    const ids = [...cardIds].sort(() => Math.random() - 0.5);
    setSession({ mode: "practice", items: buildPracticeQueue(ids), index: 0, revealed: false, graded: [] });
  };

  if (!today || !session) return <PageSkeleton label="Building your review queue" />;

  const title = unit ? `Review ${unit.code}: ${unit.title}` : "Review all units";
  const remaining = session.items.length - session.index;
  const header = (
    <div className="mb-6 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">{session.mode === "practice" ? "Practice · schedule unchanged" : "Spaced repetition · SM-2"}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        </div>
        {current && (
          <p className="text-sm text-fg-muted" aria-live="polite">
            Card <span className="font-semibold text-fg">{session.index + 1}</span> of {session.items.length}
          </p>
        )}
      </div>
      {!focusMode && <UnitFilter current={unitCode} />}
      {current && <ProgressBar value={session.index / Math.max(1, session.items.length)} label="Session progress" />}
    </div>
  );

  // Nothing due: offer practice (which never touches the schedule) or exam questions.
  if (session.items.length === 0) {
    const forecast = dueForecast(cards, today, 8).slice(1).find((d) => d.due > 0);
    return (
      <div ref={root}>
        {header}
        <div className="card mx-auto max-w-xl p-8 text-center">
          <CheckCircle2 aria-hidden="true" className="mx-auto size-12 text-ok" />
          <FocusHeading active={interacted} className="mt-4 text-xl font-semibold">
            All caught up
          </FocusHeading>
          <p className="mt-2 text-sm leading-6 text-fg-muted">
            No cards are due{unit ? ` in ${unit.code}` : ""} and today&apos;s new-card allowance is used up.
            {forecast ? ` ${forecast.due} card${forecast.due === 1 ? " is" : "s are"} due ${forecast.day === addDays(today, 1) ? "tomorrow" : `on ${forecast.day}`}.` : ""}
          </p>
          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <button type="button" onClick={practise} className="btn btn-primary">
              <Dumbbell aria-hidden="true" className="size-4" /> Practise anyway
            </button>
            <Link href={unit ? `/exam/${unit.code}` : "/exam"} className="btn btn-ghost">
              <PenLine aria-hidden="true" className="size-4" /> Exam questions
            </Link>
          </div>
          <p className="mt-4 text-xs text-fg-subtle">Practice keeps your SM-2 schedule exactly as it is.</p>
        </div>
      </div>
    );
  }

  if (!current || !entry) {
    const total = session.graded.length;
    const correct = session.graded.filter((g) => g.correct).length;
    const xp = session.graded.reduce((sum, g) => sum + g.xp, 0);
    const unique = new Set(session.graded.map((g) => g.cardId)).size;
    const tomorrow = dueForecast(cards, today, 2)[1]?.due ?? 0;
    return (
      <div ref={root}>
        {header}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card mx-auto max-w-xl p-8">
          <p className="eyebrow">Session complete</p>
          <FocusHeading active={interacted} className="mt-2 text-2xl font-semibold">
            Nice work.
          </FocusHeading>
          <dl className="mt-6 grid grid-cols-3 gap-3 text-center">
            {[
              ["Cards", unique],
              ["Accuracy", `${total ? Math.round((correct / total) * 100) : 0}%`],
              ["XP earned", `+${xp}`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-surface-2 p-3">
                <dt className="text-xs text-fg-muted">{label}</dt>
                <dd className="mt-1 font-mono text-xl font-bold">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 text-sm leading-6 text-fg-muted">
            {session.mode === "practice"
              ? "Practice answers don't change your schedule."
              : `SM-2 has rescheduled every card you graded. ${tomorrow} card${tomorrow === 1 ? " is" : "s are"} due tomorrow, and anything you missed will come back first next session.`}
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Link href="/" className="btn btn-primary">
              Command centre <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
            <Link href={unit ? `/exam/${unit.code}` : "/exam"} className="btn btn-ghost">
              <PenLine aria-hidden="true" className="size-4" /> Exam practice
            </Link>
            <button
              type="button"
              onClick={() => {
                setInteracted(true);
                setSession(null);
              }}
              className="btn btn-ghost"
            >
              <RotateCcw aria-hidden="true" className="size-4" /> Check for more
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div ref={root}>
      {header}
      <div className="mx-auto max-w-2xl space-y-4">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${session.index}-${current.cardId}`}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.18 }}
          >
            <Flashcard3D card={entry.card} unit={entry.unit} kind={current.kind} revealed={session.revealed} takeFocus={interacted} onReveal={reveal} />
          </motion.div>
        </AnimatePresence>
        <AnimatePresence>
          {session.revealed && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <GradeBar progress={cards[current.cardId]} today={today} practice={session.mode === "practice"} onGrade={grade} />
            </motion.div>
          )}
        </AnimatePresence>
        <p className="flex items-center justify-center gap-2 text-xs text-fg-subtle">
          <BookOpenCheck aria-hidden="true" className="size-3.5" />
          {remaining} card{remaining === 1 ? "" : "s"} left in this session
          {queue && session.mode === "scheduled" && session.index === 0 ? ` · ${queue.counts.repeat} repeat, ${queue.counts.review} due, ${queue.counts.new} new` : ""}
        </p>
      </div>
    </div>
  );
}
