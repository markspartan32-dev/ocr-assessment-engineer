"use client";

import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { ALL_CARD_IDS, UNITS } from "@/lib/content";
import { lastDays } from "@/lib/date";
import { levelProgress } from "@/lib/gamification";
import { MASTERED_REPETITIONS, percent } from "@/lib/mastery";
import { dueForecast } from "@/lib/srs/scheduler";
import { useMasteries, useStudyReady, useUnitQueues } from "@/hooks/useStudy";
import { useProgress } from "@/store/progress";
import { MasteryRadar } from "@/components/charts/MasteryRadar";
import { ForecastBars, TrendLine } from "@/components/charts/TrendCharts";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { UnitCode } from "@/components/ui/UnitTag";

function Tile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="card p-4">
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className="mt-1 font-mono text-2xl font-bold tracking-tight">{value}</dd>
      {detail && <dd className="mt-0.5 text-xs text-fg-subtle">{detail}</dd>}
    </div>
  );
}

export function Analytics() {
  const today = useStudyReady();
  const masteries = useMasteries();
  const queues = useUnitQueues(today);
  const { cards, exams, daily, xp, streak } = useProgress(useShallow((s) => ({ cards: s.cards, exams: s.exams, daily: s.daily, xp: s.xp, streak: s.streak })));

  const series = useMemo(() => {
    if (!today) return null;
    const days = lastDays(today, 30);
    const windowXp = days.reduce((s, d) => s + (daily[d]?.xp ?? 0), 0);
    let running = Math.max(0, xp - windowXp);
    const xpTrend = days.map((day) => ({ day, xp: (running += daily[day]?.xp ?? 0) }));
    const reviews = days.map((day) => ({ day, reviews: daily[day]?.reviews ?? 0 }));
    return { xpTrend, reviews, forecast: dueForecast(cards, today, 14) };
  }, [today, daily, xp, cards]);

  if (!today || !series || !queues) return <PageSkeleton label="Crunching your analytics" />;

  const allDays = Object.values(daily);
  const totalReviews = allDays.reduce((s, d) => s + d.reviews, 0);
  const totalCorrect = allDays.reduce((s, d) => s + d.correct, 0);
  const studied = ALL_CARD_IDS.filter((id) => cards[id]);
  const mastered = studied.filter((id) => cards[id].repetitions >= MASTERED_REPETITIONS).length;
  const examMax = UNITS.reduce((s, u) => s + u.questions.reduce((t, q) => t + q.marks, 0), 0);
  const examBest = Object.values(exams).reduce((s, r) => s + r.best, 0);
  const level = levelProgress(xp);

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Level" value={String(level.level)} detail={`${level.title} · ${xp.toLocaleString("en-GB")} XP`} />
        <Tile label="Cards studied" value={`${studied.length}/${ALL_CARD_IDS.length}`} detail={`${mastered} mastered (4+ spaced recalls)`} />
        <Tile label="Recall accuracy" value={totalReviews ? `${Math.round((totalCorrect / totalReviews) * 100)}%` : "–"} detail={`${totalReviews} reviews in total`} />
        <Tile label="Exam marks" value={`${examBest}/${examMax}`} detail={`Longest streak: ${streak.longest} day${streak.longest === 1 ? "" : "s"}`} />
      </dl>

      <section aria-labelledby="radar-title" className="card p-5">
        <h2 id="radar-title" className="font-semibold">Mastery across F200–F206</h2>
        <p className="mt-1 text-sm text-fg-muted">Recall is SM-2 progress (4 consecutive spaced recalls = 100%); exam is your best self-marked score per question.</p>
        <MasteryRadar masteries={masteries} height={380} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="xp-title" className="card p-5">
          <h2 id="xp-title" className="font-semibold">Total XP · last 30 days</h2>
          <TrendLine data={series.xpTrend} dataKey="xp" name="Total XP" format={(v) => `${Number(v).toLocaleString("en-GB")} XP`} />
        </section>
        <section aria-labelledby="reviews-title" className="card p-5">
          <h2 id="reviews-title" className="font-semibold">Cards reviewed per day · last 30 days</h2>
          <TrendLine data={series.reviews} dataKey="reviews" name="Reviews" format={(v) => `${v} card${v === 1 ? "" : "s"}`} />
        </section>
      </div>

      <section aria-labelledby="forecast-title" className="card p-5">
        <h2 id="forecast-title" className="font-semibold">Review forecast · next 14 days</h2>
        <p className="mt-1 text-sm text-fg-muted">When SM-2 will bring studied cards back (today includes anything overdue).</p>
        <ForecastBars data={series.forecast} />
      </section>

      <section aria-labelledby="table-title" className="card overflow-x-auto p-5">
        <h2 id="table-title" className="mb-3 font-semibold">Unit breakdown</h2>
        <table className="w-full min-w-[36rem] text-left text-sm">
          <caption className="sr-only">Mastery, due cards and exam scores for each unit</caption>
          <thead className="text-xs text-fg-subtle">
            <tr>
              <th scope="col" className="pb-2 font-medium">Unit</th>
              <th scope="col" className="pb-2 font-medium">Cards studied</th>
              <th scope="col" className="pb-2 font-medium">Due now</th>
              <th scope="col" className="pb-2 font-medium">Recall</th>
              <th scope="col" className="pb-2 font-medium">Exam</th>
              <th scope="col" className="pb-2 font-medium">Mastery</th>
            </tr>
          </thead>
          <tbody>
            {UNITS.map((u) => {
              const m = masteries[u.code];
              const q = queues[u.code];
              return (
                <tr key={u.code} className="border-t border-line">
                  <th scope="row" className="py-2.5 pr-4 font-normal">
                    <UnitCode code={u.code} /> <span className="ml-2 text-fg-muted">{u.title}</span>
                  </th>
                  <td className="py-2.5 font-mono">{m.cardsSeen}/10</td>
                  <td className="py-2.5 font-mono">{q.counts.repeat + q.counts.review}</td>
                  <td className="py-2.5 font-mono">{percent(m.recall)}%</td>
                  <td className="py-2.5 font-mono">{percent(m.exam)}%</td>
                  <td className="py-2.5 font-mono font-semibold">{percent(m.overall)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
