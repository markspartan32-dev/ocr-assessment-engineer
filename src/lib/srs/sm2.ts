/**
 * SuperMemo SM-2 (P. A. Wozniak, 1987), the algorithm Anki's scheduler descends from.
 *
 * Every card carries a repetition count n, an ease factor EF (starting at 2.5) and an
 * inter-repetition interval I in days. After a scheduled review the student grades recall
 * with a quality q from 0 to 5:
 *
 *   q >= 3 (recalled):   I = 1 if n = 0, 6 if n = 1, otherwise ceil(I × EF); then n += 1
 *   q <  3 (forgotten):  n = 0, I = 1. The card is relearned from the start, but EF is not reset.
 *   always:              EF' = max(1.3, EF + 0.1 − (5 − q)(0.08 + (5 − q) × 0.02))
 *
 * The interval uses the ease factor from before the review, as in the original description,
 * and fractional intervals round up. SM-2's step 7 (repeat anything graded below 4 within the
 * same session) lives in the scheduler, because it does not alter n, EF or I.
 */

export type Quality = 0 | 1 | 2 | 3 | 4 | 5;

export interface Sm2State {
  /** Consecutive successful recalls (n). */
  repetitions: number;
  /** Ease factor (EF), never below 1.3. */
  easeFactor: number;
  /** Days until the next scheduled review (I). 0 means "never reviewed". */
  interval: number;
}

export const QUALITIES: readonly Quality[] = [0, 1, 2, 3, 4, 5];
export const INITIAL_EASE_FACTOR = 2.5;
export const MIN_EASE_FACTOR = 1.3;
/** Grades at or above this count as a correct recall. */
export const PASSING_QUALITY = 3;
/** Grades below this are repeated in the same session (SM-2 step 7). */
export const REPEAT_BELOW_QUALITY = 4;

export const QUALITY_LABELS: Record<Quality, { label: string; description: string }> = {
  0: { label: "Blackout", description: "Complete blackout: no recall at all" },
  1: { label: "Wrong", description: "Incorrect, but recognised the answer once shown" },
  2: { label: "Almost", description: "Incorrect, but the answer felt easy once shown" },
  3: { label: "Hard", description: "Correct, but with serious difficulty" },
  4: { label: "Good", description: "Correct after some hesitation" },
  5: { label: "Easy", description: "Perfect, instant recall" },
};

export const initialSm2State = (): Sm2State => ({
  repetitions: 0,
  easeFactor: INITIAL_EASE_FACTOR,
  interval: 0,
});

export function isQuality(value: unknown): value is Quality {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 5;
}

export const isCorrect = (q: Quality): boolean => q >= PASSING_QUALITY;
export const needsRepeat = (q: Quality): boolean => q < REPEAT_BELOW_QUALITY;

/** Change in ease factor for a grade: +0.10, 0, −0.14, −0.32, −0.54, −0.80 for q = 5 … 0. */
export function easeDelta(q: Quality): number {
  const miss = 5 - q;
  return 0.1 - miss * (0.08 + miss * 0.02);
}

export function nextEaseFactor(easeFactor: number, q: Quality): number {
  // Every delta is a multiple of 0.02, so rounding to 2 dp removes float drift exactly.
  const next = Math.round((easeFactor + easeDelta(q)) * 100) / 100;
  return Math.max(MIN_EASE_FACTOR, next);
}

/** One SM-2 step. Pure: returns a new state and never mutates its input. */
export function sm2(state: Sm2State, q: Quality): Sm2State {
  if (!isQuality(q)) throw new RangeError(`SM-2 quality must be an integer 0–5, got ${String(q)}`);

  let { repetitions, interval } = state;
  if (isCorrect(q)) {
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    // The epsilon stops float error (e.g. 22.000000000000004) from adding a whole extra day.
    else interval = Math.ceil(interval * state.easeFactor - 1e-9);
    repetitions += 1;
  } else {
    repetitions = 0;
    interval = 1;
  }

  return { repetitions, interval, easeFactor: nextEaseFactor(state.easeFactor, q) };
}
