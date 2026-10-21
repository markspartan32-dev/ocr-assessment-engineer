"use client";

import { ArrowRight, BookOpenCheck, Flame, Focus, PenLine, Sparkles, Target } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { ALL_CARD_IDS, UNITS } from "@/lib/content";
import { levelProgress, liveStreak } from "@/lib/gamification";
import { percent } from "@/lib/mastery";
import { useMasteries, useQueue, useStudyReady, useUnitQueues } from "@/hooks/useStudy";
import { useProgress } from "@/store/progress";
import { useUi } from "@/store/ui";
import { MasteryRadar } from "@/components/charts/MasteryRadar";
import { GoalRing } from "@/components/stats/GoalRing";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { UnitCode } from "@/components/ui/UnitTag";
import { UnitGrid } from "@/components/units/UnitGrid";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export function Dashboard() {
  const today = useStudyReady();
  const router = useRouter();
  const setFocusMode = useUi((s) => s.setFocusMode);
  const queue = useQueue(ALL_CARD_IDS, today);
  const queues = useUnitQueues(today);
  const masteries = useMasteries();
  const { xp, streak, daily, goal } = useProgress(useShallow((s) => ({ xp: s.xp, streak: s.streak, daily: s.daily, goal: s.settings.dailyGoal })));

  const weakest = useMemo(() => [...UNITS].sort((a, b) => masteries[a.code].overall - masteries[b.code].overall)[0], [masteries]);

  if (!today || !queue || !queues) return <PageSkeleton />;

  const level = levelProgress(xp);
  const live = liveStreak(streak, today);
  const todayStats = daily[today];
  const reviewsToday = todayStats?.reviews ?? 0;
  const dueNow = queue.counts.repeat + queue.counts.review;
  const weakestQueue = queues[weakest.code];
  const weakestDue = weakestQueue.counts.repeat + weakestQueue.counts.review + weakestQueue.counts.new;

  const startFocus = () => {
    setFocusMode(true);
    router.push("/review");
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="card relative overflow-hidden p-6 sm:p-8">
          <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-accent/10 blur-3xl" />
          <p className="eyebrow">Command centre</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            {greeting()}, {level.title}.
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-fg-muted">
            {dueNow + queue.counts.new > 0
              ? `Your SM-2 queue has ${queue.counts.repeat ? `${queue.counts.repeat} repeat${queue.counts.repeat === 1 ? "" : "s"}, ` : ""}${queue.counts.review} due review${queue.counts.review === 1 ? "" : "s"} and ${queue.counts.new} new card${queue.counts.new === 1 ? "" : "s"} ready.`
              : "Nothing is due right now. Sharpen your exam technique, or practise freely without touching your schedule."}
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Link href="/review" className="btn btn-primary px-5 py-3 text-base">
              <BookOpenCheck aria-hidden="true" className="size-5" />
              {dueNow + queue.counts.new > 0 ? `Start review · ${queue.items.length}` : "Open review"}
            </Link>
            <button type="button" onClick={startFocus} className="btn btn-ghost px-5 py-3">
              <Focus aria-hidden="true" className="size-4" /> Review in Focus mode
            </button>
            <Link href="/exam" className="btn btn-ghost px-5 py-3">
              <PenLine aria-hidden="true" className="size-4" /> Exam practice
            </Link>
          </div>
          <div className="mt-8">
            <div className="mb-1.5 flex justify-between text-xs">
              <span className="text-fg-muted">
                Level {level.level} → {level.level + 1}
              </span>
              <span className="font-mono text-fg-muted">
                {level.remaining.toLocaleString("en-GB")} XP to go
              </span>
            </div>
            <ProgressBar value={level.ratio} label={`Progress to level ${level.level + 1}`} tone="xp" />
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-4">
          <div className="card flex flex-col justify-between p-5">
            <dt className="flex items-center gap-2 text-xs text-fg-muted">
              <Flame aria-hidden="true" className={`size-4 ${live.days ? "text-xp" : ""}`} /> Daily streak
            </dt>
            <dd>
              <span className="font-mono text-3xl font-bold">{live.days}</span>
              <span className="ml-1 text-sm text-fg-muted">day{live.days === 1 ? "" : "s"}</span>
              <span className={`mt-1 block text-xs ${live.atRisk ? "text-xp" : "text-fg-subtle"}`}>{live.atRisk ? "Study today to keep it alive" : `Best: ${streak.longest}`}</span>
            </dd>
          </div>
          <div className="card flex flex-col justify-between p-5">
            <dt className="flex items-center gap-2 text-xs text-fg-muted">
              <Target aria-hidden="true" className="size-4" /> Daily goal
            </dt>
            <dd className="flex items-center gap-3">
              <GoalRing done={reviewsToday} goal={goal} size={52} />
              <span>
                <span className="font-mono text-xl font-bold">{Math.min(reviewsToday, goal)}</span>
                <span className="text-sm text-fg-muted">/{goal}</span>
                <span className="block text-xs text-fg-subtle">{todayStats?.goalMet ? "Complete · +25 XP" : "reviews"}</span>
              </span>
            </dd>
          </div>
          <div className="card flex flex-col justify-between p-5">
            <dt className="flex items-center gap-2 text-xs text-fg-muted">
              <Sparkles aria-hidden="true" className="size-4 text-xp" /> XP today
            </dt>
            <dd className="font-mono text-3xl font-bold">+{todayStats?.xp ?? 0}</dd>
          </div>
          <div className="card flex flex-col justify-between p-5">
            <dt className="text-xs text-fg-muted">Accuracy today</dt>
            <dd className="font-mono text-3xl font-bold">{reviewsToday ? `${Math.round(((todayStats?.correct ?? 0) / reviewsToday) * 100)}%` : "–"}</dd>
          </div>
        </dl>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="card p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">Mastery radar</h2>
            <Link href="/analytics" className="text-xs text-accent hover:underline">
              Full analytics
            </Link>
          </div>
          <MasteryRadar masteries={masteries} height={300} compact />
        </div>
        <div className="card flex flex-col p-6">
          <p className="eyebrow">Next best move</p>
          <h2 className="mt-2 text-lg font-semibold">
            Shore up <UnitCode code={weakest.code} className="text-lg" /> {weakest.title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-fg-muted">
            It&apos;s your weakest unit at {percent(masteries[weakest.code].overall)}% mastery (recall {percent(masteries[weakest.code].recall)}%, exam {percent(masteries[weakest.code].exam)}%).
            {weakestDue ? ` ${weakestDue} card${weakestDue === 1 ? " is" : "s are"} ready to study.` : " All its cards are scheduled, so try its exam questions."}
          </p>
          <div className="mt-auto flex flex-col gap-2 pt-6 sm:flex-row">
            <Link href={`/review/${weakest.code}`} className="btn btn-primary">
              Review {weakest.code} <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
            <Link href={`/exam/${weakest.code}`} className="btn btn-ghost">
              {weakest.code} exam questions
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="units-heading">
        <h2 id="units-heading" className="mb-3 text-lg font-semibold">Units</h2>
        <UnitGrid />
      </section>
    </div>
  );
}
