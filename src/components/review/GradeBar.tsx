"use client";

import { useEffect, useRef } from "react";
import { gradeCard, type CardProgress } from "@/lib/srs/scheduler";
import { QUALITIES, QUALITY_LABELS, type Quality } from "@/lib/srs/sm2";
import type { DayKey } from "@/lib/date";

function intervalLabel(days: number) {
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

const TONE: Record<Quality, string> = {
  0: "border-bad/40 hover:bg-bad/15 focus-visible:bg-bad/15",
  1: "border-bad/40 hover:bg-bad/15 focus-visible:bg-bad/15",
  2: "border-bad/30 hover:bg-bad/10 focus-visible:bg-bad/10",
  3: "border-xp/40 hover:bg-xp/10 focus-visible:bg-xp/10",
  4: "border-ok/40 hover:bg-ok/10 focus-visible:bg-ok/10",
  5: "border-ok/50 hover:bg-ok/15 focus-visible:bg-ok/15",
};

/**
 * The six SM-2 grades, each previewing the interval it would schedule (as Anki does).
 * Grades below 4 also bring the card back later in this session (SM-2 step 7).
 */
export function GradeBar({ progress, today, practice, onGrade }: { progress: CardProgress | undefined; today: DayKey; practice: boolean; onGrade: (q: Quality) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  // On phones the grade buttons start below the fold; bring them into view once the answer shows.
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, []);
  return (
    <div ref={ref} role="group" aria-labelledby="grade-heading" className="card scroll-mb-24 p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="grade-heading" className="text-sm font-semibold">How well did you recall it?</h2>
        <p className="text-xs text-fg-subtle">
          Press <span className="kbd">0</span>–<span className="kbd">5</span>. Grades below 4 come back this session.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {QUALITIES.map((q) => {
          const outcome = gradeCard(progress, q, today);
          const changesSchedule = !practice && (outcome.kind === "new" || outcome.kind === "review");
          const next = changesSchedule ? intervalLabel(outcome.progress.interval) : "kept";
          const { label, description } = QUALITY_LABELS[q];
          return (
            <button
              key={q}
              type="button"
              onClick={() => onGrade(q)}
              aria-label={`${q}: ${label}. ${description}. ${changesSchedule ? `Next review in ${outcome.progress.interval} day${outcome.progress.interval === 1 ? "" : "s"}` : "Schedule unchanged"}${outcome.requeue ? ", and again later this session" : ""}.`}
              title={description}
              className={`flex flex-col items-center gap-1 rounded-xl border bg-surface-2 px-2 py-2.5 text-center transition-colors ${TONE[q]}`}
            >
              <span className="flex items-center gap-1.5">
                <span className="kbd">{q}</span>
                <span className="text-sm font-semibold">{label}</span>
              </span>
              <span className="font-mono text-xs text-fg-muted">
                {next}
                {outcome.requeue && <span className="text-bad"> ↺</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
