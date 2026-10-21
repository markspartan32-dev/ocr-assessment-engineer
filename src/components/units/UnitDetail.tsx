"use client";

import { BookOpenCheck, ChevronDown, PenLine } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { getUnit, topicTitle } from "@/lib/content";
import { hashId } from "@/lib/dom";
import type { UnitCode as Code } from "@/lib/content-types";
import { cardMastery, cardStatus, percent, type CardStatus } from "@/lib/mastery";
import { useMasteries, useStudyReady, useUnitQueues } from "@/hooks/useStudy";
import { useProgress } from "@/store/progress";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { AssessmentBadge, UnitCode } from "@/components/ui/UnitTag";

const STATUS: Record<CardStatus, { label: string; className: string }> = {
  new: { label: "New", className: "border-accent/40 text-accent" },
  due: { label: "Due", className: "border-ok/40 text-ok" },
  repeat: { label: "Repeat", className: "border-bad/40 text-bad" },
  learning: { label: "Learning", className: "border-line-strong text-fg-muted" },
  mastered: { label: "Mastered", className: "border-xp/40 text-xp" },
};

export function UnitDetail({ code }: { code: Code }) {
  const unit = getUnit(code)!;
  const today = useStudyReady();
  const masteries = useMasteries();
  const queues = useUnitQueues(today);
  const { cards, exams } = useProgress(useShallow((s) => ({ cards: s.cards, exams: s.exams })));

  // Deep links from search (#F203-FC04): open that card and bring it into view.
  useEffect(() => {
    if (!today) return;
    const id = hashId();
    if (!id || !unit.flashcards.some((c) => c.id === id)) return;
    const target = document.getElementById(id);
    if (target instanceof HTMLDetailsElement) target.open = true;
    target?.scrollIntoView({ block: "center" });
  }, [today, unit]);

  if (!today || !queues) return <PageSkeleton label={`Loading ${code}`} />;
  const m = masteries[code];
  const q = queues[code];
  const due = q.counts.repeat + q.counts.review;

  return (
    <div className="space-y-8">
      <header className="card overflow-hidden p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <UnitCode code={unit.code} className="text-sm" />
          <AssessmentBadge assessment={unit.assessment} />
          <span className="text-xs text-fg-subtle">{unit.glh} GLH</span>
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{unit.title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-fg-muted">{unit.summary}</p>
        <p className="mt-2 max-w-3xl text-xs leading-5 text-fg-subtle">
          {unit.assessmentDetail} Certificate: {unit.status.certificate}; Extended Certificate: {unit.status.extendedCertificate}.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            ["Recall (SM-2)", m.recall, "accent"],
            ["Exam score", m.exam, "xp"],
            ["Overall mastery", m.overall, "ok"],
          ].map(([label, value, tone]) => (
            <div key={label as string}>
              <div className="mb-1.5 flex justify-between text-xs">
                <span className="text-fg-muted">{label as string}</span>
                <span className="font-mono font-semibold">{percent(value as number)}%</span>
              </div>
              <ProgressBar value={value as number} label={`${label} for ${unit.code}`} tone={tone as "accent"} />
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href={`/review/${unit.code}`} className="btn btn-primary">
            <BookOpenCheck aria-hidden="true" className="size-4" /> Review {due ? `${due} due` : ""}{due && q.counts.new ? " + " : ""}{q.counts.new ? `${q.counts.new} new` : due ? "" : "cards"}
          </Link>
          <Link href={`/exam/${unit.code}`} className="btn btn-ghost">
            <PenLine aria-hidden="true" className="size-4" /> Exam practice
          </Link>
        </div>
      </header>

      <section aria-labelledby="topics">
        <h2 id="topics" className="mb-3 text-lg font-semibold">Topic areas</h2>
        <ol className="grid gap-3 md:grid-cols-2">
          {unit.topicAreas.map((t) => {
            const topicCards = unit.flashcards.filter((c) => c.topicArea === t.id);
            const recall = topicCards.length ? topicCards.reduce((s, c) => s + cardMastery(cards[c.id]), 0) / topicCards.length : 0;
            const questions = unit.questions.filter((x) => x.topicArea === t.id).length;
            return (
              <li key={t.id} className="card p-4">
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-xs text-fg-subtle">TA{t.id}</span>
                  <span className="flex-1 text-sm font-medium">{t.title}</span>
                  <span className="font-mono text-xs text-fg-muted">{percent(recall)}%</span>
                </div>
                <p className="mt-1 pl-9 text-xs text-fg-subtle">
                  {topicCards.length} flashcard{topicCards.length === 1 ? "" : "s"} · {questions} question{questions === 1 ? "" : "s"}
                </p>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="cards">
        <h2 id="cards" className="mb-3 text-lg font-semibold">Flashcards</h2>
        <ul className="space-y-2">
          {unit.flashcards.map((c) => {
            const p = cards[c.id];
            const status = STATUS[cardStatus(p, today)];
            return (
              <li key={c.id}>
                <details id={c.id} className="card group scroll-mt-24 p-4 open:border-accent/40">
                  <summary className="flex cursor-pointer list-none items-start gap-3">
                    <ChevronDown aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-fg-subtle transition-transform group-open:rotate-180" />
                    <span className="flex-1 text-sm font-medium leading-6">{c.front}</span>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.7rem] font-medium ${status.className}`}>{status.label}</span>
                  </summary>
                  <div className="mt-3 pl-7">
                    <p className="text-sm leading-6 whitespace-pre-line text-fg-muted">{c.back}</p>
                    <p className="mt-3 font-mono text-xs text-fg-subtle">
                      {c.id} · {topicTitle(unit, c.topicArea)}
                      {p ? ` · EF ${p.easeFactor.toFixed(2)} · interval ${p.interval}d · next ${p.dueDate} · ${p.reviews} review${p.reviews === 1 ? "" : "s"}` : " · not studied yet"}
                    </p>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="questions">
        <h2 id="questions" className="mb-3 text-lg font-semibold">Exam-style questions</h2>
        <ol className="space-y-2">
          {unit.questions.map((x) => {
            const r = exams[x.id];
            return (
              <li key={x.id}>
                <Link href={`/exam/${unit.code}#${x.id}`} className="card flex items-start gap-3 p-4 transition-colors hover:border-accent/50">
                  <span className="mt-0.5 w-14 shrink-0 font-mono text-xs text-fg-subtle">[{x.marks}m]</span>
                  <span className="flex-1 text-sm leading-6">{x.question}</span>
                  <span className="shrink-0 font-mono text-xs text-fg-muted">{r ? `${r.best}/${r.max}` : "—"}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
