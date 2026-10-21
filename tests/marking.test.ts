import { describe, expect, it } from "vitest";
import type { ExamQuestion } from "@/lib/content-types";
import { keywords, matchPoints, suggestMarks } from "@/lib/marking";

const points: ExamQuestion = {
  id: "F200-Q99", topicArea: 1, commandWord: "Explain", marks: 2, question: "Explain why…", modelAnswer: "…",
  markScheme: { type: "points", points: ["Validation checks data is sensible against rules (1)", "But cannot confirm the data is accurate or true (1)"] },
};

describe("keyword marking estimate", () => {
  it("normalises words and ignores mark-scheme boilerplate", () => {
    expect([...keywords("Validation checks (1) the candidate's data")]).toEqual(["valid", "check", "data"]);
  });

  it("matches points the answer covers and suggests a conservative mark", () => {
    const answer = "Validation only checks that data is sensible and follows rules, so it cannot prove it is accurate.";
    const matches = matchPoints(answer, points.markScheme.points);
    expect(matches).toEqual([true, true]);
    expect(suggestMarks(points, matches, answer)).toBe(2);
    expect(suggestMarks(points, matchPoints("no idea", points.markScheme.points), "no idea")).toBe(0);
  });

  it("uses the bottom of a level band for levels-of-response questions", () => {
    const levels: ExamQuestion = {
      ...points, marks: 6,
      markScheme: {
        type: "levels",
        points: ["descriptive analytics summarises past waste", "predictive analytics forecasts demand", "prescriptive analytics recommends order quantities", "data quality limits every type"],
        levels: [{ level: 3, marks: [5, 6], descriptor: "" }, { level: 2, marks: [3, 4], descriptor: "" }, { level: 1, marks: [1, 2], descriptor: "" }],
      },
    };
    const answer = "Predictive analytics would forecast demand so the shop orders less.";
    expect(suggestMarks(levels, matchPoints(answer, levels.markScheme.points), answer)).toBe(3);
  });
});
