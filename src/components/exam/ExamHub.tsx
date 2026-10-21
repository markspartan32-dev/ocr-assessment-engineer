"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { UNITS } from "@/lib/content";
import { percent } from "@/lib/mastery";
import { useMasteries, useStudyReady } from "@/hooks/useStudy";
import { useProgress } from "@/store/progress";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { AssessmentBadge, UnitCode } from "@/components/ui/UnitTag";

export function ExamHub() {
  const ready = useStudyReady();
  const masteries = useMasteries();
  const exams = useProgress((s) => s.exams);
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {UNITS.map((u) => {
        const m = masteries[u.code];
        const marks = u.questions.reduce((sum, q) => sum + q.marks, 0);
        const best = u.questions.reduce((sum, q) => sum + (exams[q.id]?.best ?? 0), 0);
        const extended = u.questions.filter((q) => q.marks >= 6).map((q) => `${q.marks}-mark ${q.commandWord}`);
        return (
          <li key={u.code}>
            <Link href={`/exam/${u.code}`} className="card group flex h-full flex-col p-5 transition-colors hover:border-accent/50">
              <div className="flex items-center gap-2">
                <UnitCode code={u.code} />
                <AssessmentBadge assessment={u.assessment} />
                <ArrowRight aria-hidden="true" className="ml-auto size-4 text-fg-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
              </div>
              <h2 className="mt-2 font-semibold">{u.title}</h2>
              <p className="mt-1 text-xs leading-5 text-fg-muted">10 questions · {marks} marks · includes {extended.join(", ")}</p>
              <div className="mt-auto pt-5">
                <div className="mb-1.5 flex justify-between text-xs text-fg-muted">
                  <span>{ready ? `${m.questionsAttempted}/10 attempted` : "–"}</span>
                  <span className="font-mono">{ready ? `${best}/${marks} · ${percent(m.exam)}%` : ""}</span>
                </div>
                <ProgressBar value={ready ? m.exam : 0} label={`${u.code} exam score`} tone="xp" />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
