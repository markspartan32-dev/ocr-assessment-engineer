import { describe, expect, it } from "vitest";
import { exportProgress, parseProgressFile, emptyProgress } from "@/lib/progress-schema";
import { gradeCard } from "@/lib/srs/scheduler";

const cards = new Set(["F200-FC01", "F200-FC02"]);
const questions = new Set(["F200-Q01"]);

function sample() {
  const data = emptyProgress();
  data.cards["F200-FC01"] = gradeCard(undefined, 4, "2026-10-20").progress;
  data.exams["F200-Q01"] = { attempts: 2, best: 1, max: 1, last: 1, lastAt: "2026-10-20T10:00:00.000Z" };
  data.xp = 42;
  data.streak = { current: 3, longest: 5, lastActive: "2026-10-20" };
  data.daily["2026-10-20"] = { reviews: 4, correct: 3, xp: 42, examMarks: 1, goalMet: false };
  data.log.push({ at: 1_790_000_000_000, cardId: "F200-FC01", q: 4, kind: "new" });
  return data;
}

describe("progress import", () => {
  it("round-trips an export", () => {
    const data = sample();
    const result = parseProgressFile(JSON.stringify(exportProgress(data)), cards, questions);
    expect(result).toEqual({ ok: true, data });
  });

  it("rejects files that are not DataCommand backups", () => {
    expect(parseProgressFile("not json", cards, questions)).toMatchObject({ ok: false });
    expect(parseProgressFile(JSON.stringify({ format: "other" }), cards, questions)).toMatchObject({ ok: false });
    expect(parseProgressFile(JSON.stringify({ format: "datacommand-progress", version: 99, data: {} }), cards, questions)).toMatchObject({ ok: false });
  });

  it("rejects out-of-range scheduling data instead of trusting it", () => {
    const file = exportProgress(sample()) as { data: { cards: Record<string, unknown> } };
    file.data.cards["F200-FC01"] = { ...(file.data.cards["F200-FC01"] as object), easeFactor: 0.2 };
    expect(parseProgressFile(JSON.stringify(file), cards, questions)).toMatchObject({ ok: false, error: expect.stringContaining("F200-FC01") });
  });

  it("drops ids that are not in the current content", () => {
    const file = exportProgress(sample()) as { data: { cards: Record<string, unknown>; log: unknown[] } };
    file.data.cards["<img src=x onerror=alert(1)>"] = file.data.cards["F200-FC01"];
    file.data.log.push({ at: 1, cardId: "__proto__", q: 5, kind: "new" });
    const result = parseProgressFile(JSON.stringify(file), cards, questions);
    expect(result.ok && Object.keys(result.data.cards)).toEqual(["F200-FC01"]);
    expect(result.ok && result.data.log).toHaveLength(1);
  });

  it("ignores settings outside the allowed range", () => {
    const file = exportProgress({ ...sample(), settings: { dailyGoal: 100000, newCardsPerDay: 5 } });
    const result = parseProgressFile(JSON.stringify(file), cards, questions);
    expect(result.ok && result.data.settings).toEqual({ dailyGoal: 20, newCardsPerDay: 5 });
  });
});
