/**
 * XP, levels and streaks. Pure functions; the store decides when to call them.
 */

import { addDays, type DayKey } from "./date";
import type { Quality } from "./srs/sm2";
import type { ReviewKind } from "./srs/scheduler";

/** XP for a scheduled or new card. Wrong answers earn nothing; XP rewards correct recall. */
const XP_BY_QUALITY: Record<Quality, number> = { 0: 0, 1: 0, 2: 0, 3: 6, 4: 10, 5: 12 };
/** Re-drills and voluntary practice earn a token amount, so cramming cannot farm XP. */
const XP_REDRILL = 2;
export const XP_PER_EXAM_MARK = 5;
export const XP_FULL_MARKS_BONUS = 10;
export const XP_DAILY_GOAL_BONUS = 25;

export function xpForCard(kind: ReviewKind, q: Quality): number {
  if (kind === "repeat" || kind === "practice") return q >= 4 ? XP_REDRILL : 0;
  return XP_BY_QUALITY[q];
}

export function xpForExam(marksAwarded: number, maxMarks: number, previousBest: number): number {
  // Only improvements on your previous best earn XP, so re-submitting cannot farm XP.
  const gained = Math.max(0, marksAwarded - previousBest);
  const bonus = marksAwarded === maxMarks && previousBest < maxMarks ? XP_FULL_MARKS_BONUS : 0;
  return gained * XP_PER_EXAM_MARK + bonus;
}

/** Total XP needed to reach `level` (level 1 starts at 0): 0, 100, 300, 600, 1000, … */
export function xpForLevel(level: number): number {
  return 50 * level * (level - 1);
}

export function levelFromXp(xp: number): number {
  let level = Math.max(1, Math.floor((1 + Math.sqrt(1 + (0.08 * Math.max(0, xp)))) / 2));
  // Guard against floating-point error at exact level boundaries.
  while (xpForLevel(level + 1) <= xp) level += 1;
  while (level > 1 && xpForLevel(level) > xp) level -= 1;
  return level;
}

export interface LevelProgress {
  level: number;
  title: string;
  /** XP earned inside the current level. */
  into: number;
  /** XP the current level spans. */
  span: number;
  /** XP still needed for the next level. */
  remaining: number;
  /** 0–1 progress through the current level. */
  ratio: number;
}

const LEVEL_TITLES = [
  "Data Novice",
  "Record Keeper",
  "Spreadsheet Apprentice",
  "Query Builder",
  "Pipeline Engineer",
  "Insight Analyst",
  "Dashboard Designer",
  "Machine Learning Engineer",
  "Big Data Architect",
  "Chief Data Officer",
];

export function levelTitle(level: number): string {
  return LEVEL_TITLES[Math.min(level, LEVEL_TITLES.length) - 1];
}

export function levelProgress(xp: number): LevelProgress {
  const level = levelFromXp(xp);
  const floor = xpForLevel(level);
  const span = xpForLevel(level + 1) - floor;
  const into = xp - floor;
  return { level, title: levelTitle(level), into, span, remaining: span - into, ratio: span ? into / span : 0 };
}

export interface Streak {
  current: number;
  longest: number;
  lastActive: DayKey | null;
}

export const emptyStreak = (): Streak => ({ current: 0, longest: 0, lastActive: null });

/** Record study activity on `today`. Consecutive days extend the streak; a gap restarts it at 1. */
export function recordActivity(streak: Streak, today: DayKey): Streak {
  if (streak.lastActive === today) return streak;
  const current = streak.lastActive === addDays(today, -1) ? streak.current + 1 : 1;
  return { current, longest: Math.max(streak.longest, current), lastActive: today };
}

/** The streak as it stands today: still alive if the student studied today or yesterday. */
export function liveStreak(streak: Streak, today: DayKey): { days: number; atRisk: boolean } {
  if (streak.lastActive === today) return { days: streak.current, atRisk: false };
  if (streak.lastActive === addDays(today, -1)) return { days: streak.current, atRisk: true };
  return { days: 0, atRisk: false };
}
