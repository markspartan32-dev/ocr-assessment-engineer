/**
 * Progress store: the single source of truth for what the student has learned.
 * Persisted offline-first to IndexedDB through localForage. All scheduling decisions are
 * delegated to the pure SM-2 functions in src/lib/srs.
 */

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { toDayKey, type DayKey } from "@/lib/date";
import { levelFromXp, recordActivity, xpForCard, xpForExam, XP_DAILY_GOAL_BONUS } from "@/lib/gamification";
import { emptyProgress, MAX_LOG_ENTRIES, SETTINGS_LIMITS, type DailyStat, type ProgressData, type Settings } from "@/lib/progress-schema";
import { gradeCard as sm2Grade, type ReviewKind } from "@/lib/srs/scheduler";
import type { Quality } from "@/lib/srs/sm2";
import { localForageStorage } from "./storage";

export interface Reward {
  xp: number;
  /** The new level when this action crossed a level boundary. */
  levelUp: number | null;
  /** True when this action completed today's review goal. */
  goalReached: boolean;
}

export interface CardResult extends Reward {
  kind: ReviewKind;
  correct: boolean;
  requeue: boolean;
}

interface ProgressActions {
  gradeCard: (cardId: string, q: Quality, now?: Date) => CardResult;
  recordExam: (questionId: string, marks: number, maxMarks: number, now?: Date) => Reward & { improved: boolean };
  updateSettings: (patch: Partial<Settings>) => void;
  resetProgress: () => void;
  replaceProgress: (data: ProgressData) => void;
}

export type ProgressState = ProgressData & ProgressActions;

const emptyDay = (): DailyStat => ({ reviews: 0, correct: 0, xp: 0, examMarks: 0, goalMet: false });

/** Adds XP for activity on `today`, updates the streak, and pays the daily-goal bonus once. */
function award(state: ProgressData, today: DayKey, gained: number, day: DailyStat): { patch: Partial<ProgressData>; reward: Reward } {
  const goalReached = !day.goalMet && day.reviews >= state.settings.dailyGoal;
  const total = gained + (goalReached ? XP_DAILY_GOAL_BONUS : 0);
  const xp = state.xp + total;
  const before = levelFromXp(state.xp);
  const after = levelFromXp(xp);
  return {
    patch: {
      xp,
      streak: recordActivity(state.streak, today),
      daily: { ...state.daily, [today]: { ...day, xp: day.xp + total, goalMet: day.goalMet || goalReached } },
    },
    reward: { xp: total, levelUp: after > before ? after : null, goalReached },
  };
}

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => ({
      ...emptyProgress(),

      gradeCard: (cardId, q, now = new Date()) => {
        const state = get();
        const today = toDayKey(now);
        const outcome = sm2Grade(state.cards[cardId], q, today);
        const previous = state.daily[today] ?? emptyDay();
        const day: DailyStat = { ...previous, reviews: previous.reviews + 1, correct: previous.correct + (outcome.correct ? 1 : 0) };
        const { patch, reward } = award(state, today, xpForCard(outcome.kind, q), day);
        set({
          ...patch,
          cards: { ...state.cards, [cardId]: outcome.progress },
          log: [...state.log, { at: now.getTime(), cardId, q, kind: outcome.kind }].slice(-MAX_LOG_ENTRIES),
        });
        return { ...reward, kind: outcome.kind, correct: outcome.correct, requeue: outcome.requeue };
      },

      recordExam: (questionId, marks, maxMarks, now = new Date()) => {
        const state = get();
        const today = toDayKey(now);
        const awarded = Math.max(0, Math.min(maxMarks, Math.round(marks)));
        const record = state.exams[questionId];
        const previousBest = record?.best ?? 0;
        const previous = state.daily[today] ?? emptyDay();
        const day: DailyStat = { ...previous, examMarks: previous.examMarks + awarded };
        const { patch, reward } = award(state, today, xpForExam(awarded, maxMarks, previousBest), day);
        set({
          ...patch,
          exams: {
            ...state.exams,
            [questionId]: {
              attempts: (record?.attempts ?? 0) + 1,
              best: Math.max(previousBest, awarded),
              max: maxMarks,
              last: awarded,
              lastAt: now.toISOString(),
            },
          },
        });
        return { ...reward, improved: awarded > previousBest };
      },

      updateSettings: (patch) => {
        const clamp = (value: number, [min, max]: readonly [number, number]) => Math.min(max, Math.max(min, Math.round(value)));
        const current = get().settings;
        set({
          settings: {
            dailyGoal: patch.dailyGoal === undefined ? current.dailyGoal : clamp(patch.dailyGoal, SETTINGS_LIMITS.dailyGoal),
            newCardsPerDay: patch.newCardsPerDay === undefined ? current.newCardsPerDay : clamp(patch.newCardsPerDay, SETTINGS_LIMITS.newCardsPerDay),
          },
        });
      },

      resetProgress: () => set({ ...emptyProgress(), settings: get().settings }),

      replaceProgress: (data) => set({ ...data }),
    }),
    {
      name: "datacommand-progress",
      version: 1,
      storage: createJSONStorage(() => localForageStorage),
      partialize: ({ cards, exams, xp, streak, daily, log, settings }): ProgressData => ({ cards, exams, xp, streak, daily, log, settings }),
    },
  ),
);

/** False on the server and until IndexedDB has been read, so pages can show a skeleton instead of empty stats. */
export function useProgressHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => useProgress.persist.onFinishHydration(onChange),
    () => useProgress.persist.hasHydrated(),
    () => false,
  );
}

/** Cards introduced today, across all units (counts against the daily new-card limit). */
export function introducedOn(cards: ProgressData["cards"], day: DayKey): number {
  let count = 0;
  for (const card of Object.values(cards)) if (card.introduced === day) count += 1;
  return count;
}
