"use client";

import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { UNITS } from "@/lib/content";
import type { UnitCode } from "@/lib/content-types";
import type { DayKey } from "@/lib/date";
import { unitMastery, type UnitMastery } from "@/lib/mastery";
import { buildQueue, type SessionQueue } from "@/lib/srs/scheduler";
import { introducedOn, useProgress, useProgressHydrated } from "@/store/progress";
import { useToday } from "./useToday";

/** Ready once IndexedDB has loaded and the local date is known (never during SSR). */
export function useStudyReady(): DayKey | null {
  const hydrated = useProgressHydrated();
  const today = useToday();
  return hydrated ? today : null;
}

export function useQueue(cardIds: readonly string[], today: DayKey | null): SessionQueue | null {
  const { cards, newCardsPerDay } = useProgress(useShallow((s) => ({ cards: s.cards, newCardsPerDay: s.settings.newCardsPerDay })));
  return useMemo(() => {
    if (!today) return null;
    return buildQueue(cardIds, cards, { today, newCardsPerDay, introducedToday: introducedOn(cards, today) });
  }, [cardIds, cards, newCardsPerDay, today]);
}

export function useMasteries(): Record<UnitCode, UnitMastery> {
  const { cards, exams } = useProgress(useShallow((s) => ({ cards: s.cards, exams: s.exams })));
  return useMemo(
    () =>
      Object.fromEntries(
        UNITS.map((u) => [u.code, unitMastery(u.flashcards.map((c) => c.id), u.questions.map((q) => q.id), cards, exams)]),
      ) as Record<UnitCode, UnitMastery>,
    [cards, exams],
  );
}

/** Due/new counts per unit, computed with the same scheduler the review session uses. */
export function useUnitQueues(today: DayKey | null): Record<UnitCode, SessionQueue> | null {
  const { cards, newCardsPerDay } = useProgress(useShallow((s) => ({ cards: s.cards, newCardsPerDay: s.settings.newCardsPerDay })));
  return useMemo(() => {
    if (!today) return null;
    const introducedToday = introducedOn(cards, today);
    return Object.fromEntries(
      UNITS.map((u) => [u.code, buildQueue(u.flashcards.map((c) => c.id), cards, { today, newCardsPerDay, introducedToday })]),
    ) as Record<UnitCode, SessionQueue>;
  }, [cards, newCardsPerDay, today]);
}
