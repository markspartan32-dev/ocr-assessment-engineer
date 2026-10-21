/**
 * Mastery metrics behind the radar chart and unit cards.
 *
 * - Recall: SM-2 repetitions per card, capped at 4 (intervals 1 → 6 → ~15 → ~38 days).
 *   A card is fully mastered after four consecutive spaced recalls, and a lapse resets it.
 * - Exam: the best self-assessed mark ratio per question; unattempted questions count as 0.
 * - Overall: the mean of recall and exam, so both knowing and applying knowledge count.
 */

import type { CardProgress } from "./srs/scheduler";

export const MASTERED_REPETITIONS = 4;

export interface ExamRecord {
  attempts: number;
  best: number;
  max: number;
  last: number;
  lastAt: string;
}

export function cardMastery(progress: CardProgress | undefined): number {
  if (!progress) return 0;
  return Math.min(progress.repetitions, MASTERED_REPETITIONS) / MASTERED_REPETITIONS;
}

export interface UnitMastery {
  recall: number;
  exam: number;
  overall: number;
  cardsSeen: number;
  questionsAttempted: number;
}

export function unitMastery(
  cardIds: readonly string[],
  questionIds: readonly string[],
  cards: Readonly<Record<string, CardProgress | undefined>>,
  exams: Readonly<Record<string, ExamRecord | undefined>>,
): UnitMastery {
  const recall = cardIds.length ? cardIds.reduce((sum, id) => sum + cardMastery(cards[id]), 0) / cardIds.length : 0;
  const exam = questionIds.length
    ? questionIds.reduce((sum, id) => {
        const record = exams[id];
        return sum + (record && record.max > 0 ? record.best / record.max : 0);
      }, 0) / questionIds.length
    : 0;
  return {
    recall,
    exam,
    overall: (recall + exam) / 2,
    cardsSeen: cardIds.filter((id) => cards[id]).length,
    questionsAttempted: questionIds.filter((id) => exams[id]).length,
  };
}

export const percent = (ratio: number): number => Math.round(ratio * 100);
