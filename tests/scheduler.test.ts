import { describe, expect, it } from "vitest";
import { addDays, daysBetween, isDayKey, lastDays, toDayKey } from "@/lib/date";
import { buildQueue, dueForecast, gradeCard, requeueAfter, reviewKind, type CardProgress } from "@/lib/srs/scheduler";

const TODAY = "2026-03-28"; // the day before the UK clocks change
const tomorrow = addDays(TODAY, 1);

describe("calendar days", () => {
  it("crosses month, year and DST boundaries", () => {
    expect(addDays(TODAY, 1)).toBe("2026-03-29");
    expect(addDays(TODAY, 4)).toBe("2026-04-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(daysBetween("2026-03-28", "2026-04-02")).toBe(5);
    expect(lastDays("2026-01-02", 3)).toEqual(["2025-12-31", "2026-01-01", "2026-01-02"]);
  });

  it("formats local dates and validates keys", () => {
    expect(toDayKey(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
    expect(isDayKey("2026-02-29")).toBe(false);
    expect(isDayKey("2028-02-29")).toBe(true);
    expect(isDayKey("2026-1-5")).toBe(false);
  });
});

describe("gradeCard", () => {
  it("schedules a new card for tomorrow when it is recalled", () => {
    const { progress, kind, requeue } = gradeCard(undefined, 5, TODAY);
    expect(kind).toBe("new");
    expect(progress).toMatchObject({ repetitions: 1, interval: 1, dueDate: tomorrow, introduced: TODAY, pendingRepeat: false });
    expect(requeue).toBe(false);
  });

  it("flags a wrong answer so the card reappears in the next session", () => {
    const { progress, requeue, correct } = gradeCard(undefined, 1, TODAY);
    expect(correct).toBe(false);
    expect(requeue).toBe(true);
    expect(progress.pendingRepeat).toBe(true);
    expect(reviewKind(progress, TODAY)).toBe("repeat");
  });

  it("re-drills without touching the SM-2 schedule", () => {
    const first = gradeCard(undefined, 2, TODAY).progress;
    const repeat = gradeCard(first, 5, TODAY);
    expect(repeat.kind).toBe("repeat");
    expect(repeat.progress).toMatchObject({ repetitions: first.repetitions, easeFactor: first.easeFactor, interval: first.interval, dueDate: first.dueDate, pendingRepeat: false });
    expect(repeat.progress.reviews).toBe(2);
  });

  it("increases the interval on each correct scheduled review", () => {
    let progress: CardProgress | undefined;
    let day = TODAY;
    const intervals: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      progress = gradeCard(progress, 4, day).progress;
      intervals.push(progress.interval);
      day = progress.dueDate;
    }
    expect(intervals).toEqual([1, 6, 15, 38]);
  });

  it("counts a lapse only for a card that had been learned", () => {
    const learned = gradeCard(gradeCard(undefined, 4, TODAY).progress, 4, tomorrow).progress;
    const lapsed = gradeCard(learned, 0, learned.dueDate).progress;
    expect(lapsed).toMatchObject({ repetitions: 0, interval: 1, lapses: 1 });
    expect(gradeCard(undefined, 0, TODAY).progress.lapses).toBe(0);
  });

  it("leaves the schedule alone during voluntary practice", () => {
    const progress = gradeCard(undefined, 5, TODAY).progress;
    const practice = gradeCard(progress, 0, TODAY);
    expect(practice.kind).toBe("practice");
    expect(practice.progress).toEqual({ ...progress, reviews: 2 });
  });
});

describe("buildQueue", () => {
  const card = (overrides: Partial<CardProgress>): CardProgress => ({
    repetitions: 2, easeFactor: 2.5, interval: 6, dueDate: TODAY, introduced: "2026-03-01", lastReviewed: "2026-03-22",
    lastQuality: 4, reviews: 3, lapses: 0, pendingRepeat: false, ...overrides,
  });

  it("orders repeats, then the most overdue and hardest reviews, then new cards", () => {
    const progress = {
      a: card({ dueDate: addDays(TODAY, 3) }),
      b: card({ dueDate: addDays(TODAY, -4) }),
      c: card({ dueDate: TODAY, easeFactor: 1.5 }),
      d: card({ dueDate: TODAY, easeFactor: 2.8 }),
      e: card({ dueDate: tomorrow, pendingRepeat: true }),
    };
    const queue = buildQueue(["a", "b", "c", "d", "e", "f", "g"], progress, { today: TODAY, newCardsPerDay: 1, introducedToday: 0 });
    expect(queue.items.map((i) => `${i.kind}:${i.cardId}`)).toEqual(["repeat:e", "review:b", "review:c", "review:d", "new:f"]);
    expect(queue.counts).toEqual({ repeat: 1, review: 3, new: 1 });
  });

  it("respects the daily new-card allowance", () => {
    const ids = ["n1", "n2", "n3", "n4"];
    expect(buildQueue(ids, {}, { today: TODAY, newCardsPerDay: 3, introducedToday: 2 }).items).toHaveLength(1);
    expect(buildQueue(ids, {}, { today: TODAY, newCardsPerDay: 3, introducedToday: 5 }).items).toHaveLength(0);
  });

  it("never duplicates a card", () => {
    const queue = buildQueue(["x", "x", "y"], {}, { today: TODAY, newCardsPerDay: 10, introducedToday: 0 });
    expect(queue.items.map((i) => i.cardId)).toEqual(["x", "y"]);
  });
});

describe("requeueAfter (SM-2 step 7)", () => {
  const items = ["a", "b", "c", "d", "e"].map((cardId) => ({ cardId, kind: "review" as const }));

  it("brings a failed card back a few cards later as a repeat", () => {
    const next = requeueAfter(items, 0, items[0], 3);
    expect(next.map((i) => `${i.kind}:${i.cardId}`)).toEqual(["review:a", "review:b", "review:c", "review:d", "repeat:a", "review:e"]);
  });

  it("appends to the end of a short queue and keeps practice as practice", () => {
    const practice = [{ cardId: "p", kind: "practice" as const }];
    expect(requeueAfter(practice, 0, practice[0])).toEqual([practice[0], { cardId: "p", kind: "practice" }]);
  });
});

describe("dueForecast", () => {
  it("buckets overdue cards into today", () => {
    const base = gradeCard(undefined, 4, TODAY).progress;
    const forecast = dueForecast({ a: { ...base, dueDate: addDays(TODAY, -2) }, b: base, c: { ...base, dueDate: addDays(TODAY, 30) } }, TODAY, 7);
    expect(forecast[0]).toEqual({ day: TODAY, due: 1 });
    expect(forecast[1]).toEqual({ day: tomorrow, due: 1 });
    expect(forecast.reduce((s, d) => s + d.due, 0)).toBe(2);
  });
});
