/**
 * Session scheduling on top of SM-2.
 *
 * - "new"      Never seen. SM-2 is applied from the initial state.
 * - "review"   Due today or overdue. SM-2 is applied.
 * - "repeat"   Graded below 4 earlier and not yet re-drilled. Repeats come first in the next
 *              session, even later the same day, and do not change n, EF or I (SM-2 step 7).
 * - "practice" Not due; studied voluntarily ("cram"). The schedule is left untouched.
 */

import { addDays, daysBetween, type DayKey } from "../date";
import { initialSm2State, isCorrect, needsRepeat, sm2, type Quality, type Sm2State } from "./sm2";

export interface CardProgress extends Sm2State {
  /** Next scheduled review day. */
  dueDate: DayKey;
  /** Day the card was first studied. */
  introduced: DayKey;
  lastReviewed: DayKey;
  lastQuality: Quality;
  /** Every graded response, including repeats. */
  reviews: number;
  /** Scheduled reviews answered incorrectly after the card had been learned. */
  lapses: number;
  /** Graded below 4 and still waiting for a successful re-drill. */
  pendingRepeat: boolean;
}

export type ReviewKind = "new" | "review" | "repeat" | "practice";

export interface QueueItem {
  cardId: string;
  kind: ReviewKind;
}

export interface GradeOutcome {
  progress: CardProgress;
  kind: ReviewKind;
  correct: boolean;
  /** True when the card should come round again in this session (SM-2 step 7). */
  requeue: boolean;
}

export function reviewKind(progress: CardProgress | undefined, today: DayKey): ReviewKind {
  if (!progress) return "new";
  if (progress.dueDate <= today) return "review";
  if (progress.pendingRepeat) return "repeat";
  return "practice";
}

export function gradeCard(progress: CardProgress | undefined, q: Quality, today: DayKey): GradeOutcome {
  const kind = reviewKind(progress, today);
  const correct = isCorrect(q);
  const requeue = needsRepeat(q);

  if (kind === "practice" && progress) {
    // Voluntary study: count the response, keep the schedule.
    return { kind, correct, requeue, progress: { ...progress, reviews: progress.reviews + 1 } };
  }

  if (kind === "repeat" && progress) {
    return {
      kind,
      correct,
      requeue,
      progress: { ...progress, lastReviewed: today, lastQuality: q, reviews: progress.reviews + 1, pendingRepeat: requeue },
    };
  }

  const before: Sm2State = progress ?? initialSm2State();
  const next = sm2(before, q);
  return {
    kind,
    correct,
    requeue,
    progress: {
      ...next,
      dueDate: addDays(today, next.interval),
      introduced: progress?.introduced ?? today,
      lastReviewed: today,
      lastQuality: q,
      reviews: (progress?.reviews ?? 0) + 1,
      lapses: (progress?.lapses ?? 0) + (progress && progress.repetitions > 0 && !correct ? 1 : 0),
      pendingRepeat: requeue,
    },
  };
}

export interface QueueOptions {
  today: DayKey;
  /** New cards the student may start per day. */
  newCardsPerDay: number;
  /** All new cards introduced today, across every unit (counts against the daily limit). */
  introducedToday: number;
}

export interface SessionQueue {
  items: QueueItem[];
  counts: Record<Exclude<ReviewKind, "practice">, number>;
}

/**
 * Builds a study queue from `cardIds` (in syllabus order): pending repeats first, then due
 * reviews (most overdue, then hardest first), then new cards up to the daily allowance.
 */
export function buildQueue(
  cardIds: readonly string[],
  progress: Readonly<Record<string, CardProgress | undefined>>,
  { today, newCardsPerDay, introducedToday }: QueueOptions,
): SessionQueue {
  const repeats: QueueItem[] = [];
  const due: { item: QueueItem; overdue: number; ease: number }[] = [];
  const fresh: QueueItem[] = [];
  const newAllowance = Math.max(0, newCardsPerDay - introducedToday);

  for (const cardId of new Set(cardIds)) {
    const p = progress[cardId];
    const kind = reviewKind(p, today);
    if (kind === "repeat") repeats.push({ cardId, kind });
    else if (kind === "review" && p) due.push({ item: { cardId, kind }, overdue: daysBetween(p.dueDate, today), ease: p.easeFactor });
    else if (kind === "new" && fresh.length < newAllowance) fresh.push({ cardId, kind });
  }

  due.sort((a, b) => b.overdue - a.overdue || a.ease - b.ease);
  const items = [...repeats, ...due.map((d) => d.item), ...fresh];
  return { items, counts: { repeat: repeats.length, review: due.length, new: fresh.length } };
}

/** Practice queue for voluntary study of cards that are not due (schedule unchanged). */
export function buildPracticeQueue(cardIds: readonly string[]): QueueItem[] {
  return [...new Set(cardIds)].map((cardId) => ({ cardId, kind: "practice" as const }));
}

/**
 * SM-2 step 7: a card graded below 4 comes round again later in the same session.
 * It is re-inserted `gap` places after the current position, or at the end of a short queue.
 * Re-drills are "repeat" (or "practice") items, so they never re-apply SM-2 on the same day.
 */
export function requeueAfter(items: readonly QueueItem[], index: number, item: QueueItem, gap = 3): QueueItem[] {
  const repeat: QueueItem = { cardId: item.cardId, kind: item.kind === "practice" ? "practice" : "repeat" };
  const rest = items.slice(index + 1).filter((i) => i.cardId !== item.cardId);
  const at = Math.min(gap, rest.length);
  return [...items.slice(0, index + 1), ...rest.slice(0, at), repeat, ...rest.slice(at)];
}

/** Cards that become due on each of the next `days` days (today first, overdue included). */
export function dueForecast(
  progress: Readonly<Record<string, CardProgress | undefined>>,
  today: DayKey,
  days: number,
): { day: DayKey; due: number }[] {
  const forecast = Array.from({ length: days }, (_, i) => ({ day: addDays(today, i), due: 0 }));
  for (const p of Object.values(progress)) {
    if (!p) continue;
    const offset = Math.max(0, daysBetween(today, p.dueDate));
    if (offset < days) forecast[offset].due += 1;
  }
  return forecast;
}
