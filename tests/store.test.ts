import { beforeEach, describe, expect, it } from "vitest";
import { introducedOn, useProgress } from "@/store/progress";

const day = (d: number) => new Date(2026, 9, d, 12);

describe("progress store", () => {
  beforeEach(() => {
    useProgress.getState().resetProgress();
    useProgress.getState().updateSettings({ dailyGoal: 5, newCardsPerDay: 15 });
  });

  it("schedules a graded card with SM-2 and awards XP for correct recall", () => {
    const result = useProgress.getState().gradeCard("F200-FC01", 5, day(20));
    const state = useProgress.getState();
    expect(result).toMatchObject({ kind: "new", correct: true, xp: 12, levelUp: null });
    expect(state.cards["F200-FC01"]).toMatchObject({ repetitions: 1, interval: 1, dueDate: "2026-10-21" });
    expect(state.streak).toEqual({ current: 1, longest: 1, lastActive: "2026-10-20" });
    expect(introducedOn(state.cards, "2026-10-20")).toBe(1);
  });

  it("awards no XP for a wrong answer but keeps the card pending", () => {
    const result = useProgress.getState().gradeCard("F200-FC02", 1, day(20));
    expect(result).toMatchObject({ correct: false, requeue: true, xp: 0 });
    expect(useProgress.getState().cards["F200-FC02"].pendingRepeat).toBe(true);
  });

  it("pays the daily goal bonus once and reports level-ups", () => {
    const store = useProgress.getState();
    const rewards = ["01", "02", "03", "04", "05", "06"].map((n) => store.gradeCard(`F201-FC${n}`, 5, day(20)));
    expect(rewards.map((r) => r.goalReached)).toEqual([false, false, false, false, true, false]);
    // 5 × 12 XP + 25 bonus = 85, then 97 after the sixth card: still level 1.
    expect(useProgress.getState().xp).toBe(97);
    const levelUp = store.recordExam("F201-Q10", 9, 9, day(20));
    expect(levelUp).toMatchObject({ xp: 55, levelUp: 2, improved: true });
  });

  it("only pays exam XP for improvements", () => {
    const store = useProgress.getState();
    expect(store.recordExam("F200-Q05", 2, 3, day(20)).xp).toBe(10);
    expect(store.recordExam("F200-Q05", 1, 3, day(20))).toMatchObject({ xp: 0, improved: false });
    expect(useProgress.getState().exams["F200-Q05"]).toMatchObject({ attempts: 2, best: 2, last: 1 });
  });

  it("resets progress but keeps settings", () => {
    useProgress.getState().gradeCard("F200-FC01", 4, day(20));
    useProgress.getState().resetProgress();
    const state = useProgress.getState();
    expect(state.cards).toEqual({});
    expect(state.xp).toBe(0);
    expect(state.settings.dailyGoal).toBe(5);
  });
});
