/**
 * Progress data model, plus strict validation for imported backups.
 *
 * An imported file is untrusted input. Every field is type- and range-checked, unknown card
 * and question ids are dropped, and nothing reaches the store until the whole file has
 * validated. Content is always rendered as text, so a malicious file can at worst carry
 * numbers that fail these checks.
 */

import { isDayKey, type DayKey } from "./date";
import { emptyStreak, type Streak } from "./gamification";
import type { ExamRecord } from "./mastery";
import type { CardProgress, ReviewKind } from "./srs/scheduler";
import { isQuality, MIN_EASE_FACTOR, type Quality } from "./srs/sm2";

export interface DailyStat {
  reviews: number;
  correct: number;
  xp: number;
  examMarks: number;
  goalMet: boolean;
}

export interface ReviewLogEntry {
  at: number;
  cardId: string;
  q: Quality;
  kind: ReviewKind;
}

export interface Settings {
  /** Card reviews per day that complete the daily goal. */
  dailyGoal: number;
  /** New cards introduced per day across all units. */
  newCardsPerDay: number;
  /** Single-key shortcuts (0–5 to grade, Shift+F for Focus mode). Can be turned off (WCAG 2.1.4). */
  shortcuts: boolean;
}

export interface ProgressData {
  cards: Record<string, CardProgress>;
  exams: Record<string, ExamRecord>;
  xp: number;
  streak: Streak;
  daily: Record<DayKey, DailyStat>;
  log: ReviewLogEntry[];
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = { dailyGoal: 20, newCardsPerDay: 15, shortcuts: true };
export const SETTINGS_LIMITS = { dailyGoal: [5, 200], newCardsPerDay: [0, 70] } as const;
export const MAX_LOG_ENTRIES = 5000;
export const EXPORT_FORMAT = "datacommand-progress";
export const EXPORT_VERSION = 1;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export const emptyProgress = (): ProgressData => ({
  cards: {},
  exams: {},
  xp: 0,
  streak: emptyStreak(),
  daily: {},
  log: [],
  settings: { ...DEFAULT_SETTINGS },
});

export function exportProgress(data: ProgressData, now = new Date()) {
  return { format: EXPORT_FORMAT, version: EXPORT_VERSION, exportedAt: now.toISOString(), data };
}

// ---- Validation --------------------------------------------------------------------------

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isInt = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
const isNum = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const REVIEW_KINDS: readonly ReviewKind[] = ["new", "review", "repeat", "practice"];

function parseCard(v: unknown): CardProgress | null {
  if (!isObject(v)) return null;
  const ok =
    isInt(v.repetitions, 0, 10_000) &&
    isNum(v.easeFactor, MIN_EASE_FACTOR, 10) &&
    isInt(v.interval, 0, 36_500) &&
    isDayKey(v.dueDate) &&
    isDayKey(v.introduced) &&
    isDayKey(v.lastReviewed) &&
    isQuality(v.lastQuality) &&
    isInt(v.reviews, 0, 1_000_000) &&
    isInt(v.lapses, 0, 1_000_000) &&
    typeof v.pendingRepeat === "boolean";
  if (!ok) return null;
  return {
    repetitions: v.repetitions as number,
    easeFactor: v.easeFactor as number,
    interval: v.interval as number,
    dueDate: v.dueDate as DayKey,
    introduced: v.introduced as DayKey,
    lastReviewed: v.lastReviewed as DayKey,
    lastQuality: v.lastQuality as Quality,
    reviews: v.reviews as number,
    lapses: v.lapses as number,
    pendingRepeat: v.pendingRepeat as boolean,
  };
}

function parseExam(v: unknown, tariff: number): ExamRecord | null {
  if (!isObject(v)) return null;
  if (v.max !== tariff || !isInt(v.best, 0, tariff) || !isInt(v.last, 0, tariff)) return null;
  if (!isInt(v.attempts, 1, 1_000_000) || typeof v.lastAt !== "string" || Number.isNaN(Date.parse(v.lastAt))) return null;
  return { attempts: v.attempts as number, best: v.best as number, max: v.max as number, last: v.last as number, lastAt: new Date(v.lastAt).toISOString() };
}

function parseDaily(v: unknown): DailyStat | null {
  if (!isObject(v)) return null;
  if (!isInt(v.reviews, 0, 1_000_000) || !isInt(v.correct, 0, v.reviews as number) || !isInt(v.xp, 0, 10_000_000) || !isInt(v.examMarks, 0, 1_000_000)) return null;
  if (typeof v.goalMet !== "boolean") return null;
  return { reviews: v.reviews as number, correct: v.correct as number, xp: v.xp as number, examMarks: v.examMarks as number, goalMet: v.goalMet };
}

/**
 * Validates an exported progress file. `cardIds` and `questionMarks` (question id → mark
 * tariff) describe the current content; unknown ids are dropped rather than imported, and an
 * exam record must match its question's real tariff.
 */
export function parseProgressFile(text: string, cardIds: ReadonlySet<string>, questionMarks: ReadonlyMap<string, number>): Result<ProgressData> {
  if (text.length > MAX_IMPORT_BYTES) return { ok: false, error: "File is too large to be a DataCommand backup." };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "File is not valid JSON." };
  }
  if (!isObject(raw) || raw.format !== EXPORT_FORMAT) return { ok: false, error: "This is not a DataCommand progress backup." };
  if (raw.version !== EXPORT_VERSION) return { ok: false, error: `Unsupported backup version ${String(raw.version)}.` };
  const d = raw.data;
  if (!isObject(d)) return { ok: false, error: "Backup has no progress data." };

  const data = emptyProgress();
  if (!isObject(d.cards) || !isObject(d.exams) || !isObject(d.daily) || !Array.isArray(d.log)) {
    return { ok: false, error: "Backup is missing required sections." };
  }
  for (const [id, value] of Object.entries(d.cards)) {
    if (!cardIds.has(id)) continue;
    const card = parseCard(value);
    if (!card) return { ok: false, error: `Flashcard ${id} has invalid scheduling data.` };
    data.cards[id] = card;
  }
  for (const [id, value] of Object.entries(d.exams)) {
    const tariff = questionMarks.get(id);
    if (tariff === undefined) continue;
    const exam = parseExam(value, tariff);
    if (!exam) return { ok: false, error: `Question ${id} has an invalid exam record.` };
    data.exams[id] = exam;
  }
  for (const [day, value] of Object.entries(d.daily)) {
    const stat = parseDaily(value);
    if (!isDayKey(day) || !stat) return { ok: false, error: `Daily statistics for ${day} are invalid.` };
    data.daily[day] = stat;
  }
  for (const entry of d.log.slice(-MAX_LOG_ENTRIES)) {
    if (!isObject(entry)) continue;
    if (isInt(entry.at, 0, 8.64e15) && typeof entry.cardId === "string" && cardIds.has(entry.cardId) && isQuality(entry.q) && REVIEW_KINDS.includes(entry.kind as ReviewKind)) {
      data.log.push({ at: entry.at, cardId: entry.cardId, q: entry.q, kind: entry.kind as ReviewKind });
    }
  }
  if (!isInt(d.xp, 0, 1_000_000_000)) return { ok: false, error: "XP total is invalid." };
  data.xp = d.xp;

  const s = d.streak;
  if (!isObject(s) || !isInt(s.current, 0, 100_000) || !isInt(s.longest, 0, 100_000) || (s.lastActive !== null && !isDayKey(s.lastActive))) {
    return { ok: false, error: "Streak data is invalid." };
  }
  data.streak = { current: s.current, longest: Math.max(s.longest, s.current), lastActive: s.lastActive as DayKey | null };

  if (isObject(d.settings)) {
    const { dailyGoal, newCardsPerDay, shortcuts } = d.settings;
    if (isInt(dailyGoal, ...SETTINGS_LIMITS.dailyGoal)) data.settings.dailyGoal = dailyGoal;
    if (isInt(newCardsPerDay, ...SETTINGS_LIMITS.newCardsPerDay)) data.settings.newCardsPerDay = newCardsPerDay;
    if (typeof shortcuts === "boolean") data.settings.shortcuts = shortcuts;
  }
  return { ok: true, data };
}
