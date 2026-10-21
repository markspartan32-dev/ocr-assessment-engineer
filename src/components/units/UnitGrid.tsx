"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { UNITS } from "@/lib/content";
import { percent } from "@/lib/mastery";
import { useMasteries, useStudyReady, useUnitQueues } from "@/hooks/useStudy";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { AssessmentBadge, UnitCode } from "@/components/ui/UnitTag";

export function UnitGrid() {
  const today = useStudyReady();
  const masteries = useMasteries();
  const queues = useUnitQueues(today);
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {UNITS.map((u) => {
        const m = masteries[u.code];
        const q = queues?.[u.code];
        const due = q ? q.counts.repeat + q.counts.review : 0;
        return (
          <li key={u.code} className="card group relative flex flex-col p-5 transition-colors hover:border-accent/50">
            <div className="flex items-center gap-2">
              <UnitCode code={u.code} />
              <AssessmentBadge assessment={u.assessment} />
              {q && due > 0 && <span className="ml-auto rounded-full bg-ok/15 px-2 py-0.5 text-[0.7rem] font-semibold text-ok">{due} due</span>}
            </div>
            <h2 className="mt-2 pr-6 font-semibold">
              <Link href={`/units/${u.code}`} className="after:absolute after:inset-0 after:rounded-2xl">
                {u.title}
              </Link>
            </h2>
            <ArrowUpRight aria-hidden="true" className="absolute right-4 top-12 size-4 text-fg-subtle transition-colors group-hover:text-accent" />
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-fg-muted">{u.summary}</p>
            <div className="mt-auto pt-5">
              <div className="mb-1.5 flex justify-between text-xs">
                <span className="text-fg-muted">Mastery</span>
                <span className="font-mono font-semibold">{today ? `${percent(m.overall)}%` : "–"}</span>
              </div>
              <ProgressBar value={today ? m.overall : 0} label={`${u.code} mastery`} tone="ok" />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
