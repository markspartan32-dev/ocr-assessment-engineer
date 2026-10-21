import { describe, expect, it } from "vitest";
import { levelFromXp, levelProgress, liveStreak, recordActivity, xpForCard, xpForExam, xpForLevel, emptyStreak } from "@/lib/gamification";

describe("levels", () => {
  it("uses triangular XP thresholds", () => {
    expect([1, 2, 3, 4, 5].map(xpForLevel)).toEqual([0, 100, 300, 600, 1000]);
    expect([0, 99, 100, 299, 300, 999, 1000].map(levelFromXp)).toEqual([1, 1, 2, 2, 3, 4, 5]);
  });

  it("reports progress within a level", () => {
    expect(levelProgress(150)).toMatchObject({ level: 2, into: 50, span: 200, remaining: 150, ratio: 0.25, title: "Record Keeper" });
  });
});

describe("XP", () => {
  it("rewards correct recall only", () => {
    expect([0, 1, 2, 3, 4, 5].map((q) => xpForCard("review", q as 0))).toEqual([0, 0, 0, 6, 10, 12]);
    expect(xpForCard("repeat", 5)).toBe(2);
    expect(xpForCard("practice", 3)).toBe(0);
  });

  it("pays exam XP only for improvement, plus a full-marks bonus", () => {
    expect(xpForExam(4, 6, 0)).toBe(20);
    expect(xpForExam(6, 6, 4)).toBe(20);
    expect(xpForExam(6, 6, 6)).toBe(0);
    expect(xpForExam(2, 6, 4)).toBe(0);
  });
});

describe("streaks", () => {
  it("extends on consecutive days and restarts after a gap", () => {
    let streak = recordActivity(emptyStreak(), "2026-10-19");
    streak = recordActivity(streak, "2026-10-19");
    streak = recordActivity(streak, "2026-10-20");
    expect(streak).toEqual({ current: 2, longest: 2, lastActive: "2026-10-20" });
    streak = recordActivity(streak, "2026-10-23");
    expect(streak).toEqual({ current: 1, longest: 2, lastActive: "2026-10-23" });
  });

  it("is at risk the day after studying and lost after that", () => {
    const streak = { current: 5, longest: 5, lastActive: "2026-10-20" };
    expect(liveStreak(streak, "2026-10-20")).toEqual({ days: 5, atRisk: false });
    expect(liveStreak(streak, "2026-10-21")).toEqual({ days: 5, atRisk: true });
    expect(liveStreak(streak, "2026-10-22")).toEqual({ days: 0, atRisk: false });
  });
});
