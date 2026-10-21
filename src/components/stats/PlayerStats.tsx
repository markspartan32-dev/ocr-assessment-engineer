"use client";

import { Flame, Target } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { levelProgress, liveStreak } from "@/lib/gamification";
import { useProgress } from "@/store/progress";
import { useStudyReady } from "@/hooks/useStudy";
import { GoalRing } from "./GoalRing";

/** Compact streak / daily goal / level readout for the top bar. */
export function PlayerStats() {
  const today = useStudyReady();
  const { xp, streak, daily, goal } = useProgress(useShallow((s) => ({ xp: s.xp, streak: s.streak, daily: s.daily, goal: s.settings.dailyGoal })));
  if (!today) return <div className="h-9 w-48" aria-hidden="true" />;

  const live = liveStreak(streak, today);
  const level = levelProgress(xp);
  const reviewsToday = daily[today]?.reviews ?? 0;

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <div
        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm font-semibold ${live.days > 0 ? "border-xp/40 bg-xp/10 text-xp" : "border-line-strong text-fg-muted"}`}
        title={live.atRisk ? "Study today to keep your streak" : "Daily streak"}
      >
        <Flame aria-hidden="true" className="size-4" />
        <span>{live.days}</span>
        <span className="sr-only">day streak{live.atRisk ? ", study today to keep it" : ""}</span>
      </div>
      <div className="hidden items-center gap-2 sm:flex" title="Today's review goal">
        <div className="relative">
          <GoalRing done={reviewsToday} goal={goal} size={34} />
          <Target aria-hidden="true" className="absolute inset-0 m-auto size-3.5 text-fg-muted" />
        </div>
        <span className="text-xs text-fg-muted">
          <span className="font-semibold text-fg">{Math.min(reviewsToday, goal)}</span>/{goal}
          <span className="sr-only"> reviews towards today&apos;s goal</span>
        </span>
      </div>
      <div className="flex items-center gap-2 rounded-full border border-line-strong bg-surface-2 py-1 pl-1 pr-3">
        <span className="grid size-7 place-items-center rounded-full bg-accent font-mono text-xs font-bold text-ink" aria-hidden="true">{level.level}</span>
        <span className="hidden text-xs leading-tight sm:block">
          <span className="block font-semibold text-fg">{level.title}</span>
          <span className="block text-fg-subtle">{xp.toLocaleString("en-GB")} XP</span>
        </span>
        <span className="sr-only">Level {level.level}, {level.title}, {xp} XP</span>
      </div>
    </div>
  );
}
