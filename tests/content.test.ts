import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import blueprint from "@/content/blueprint.json";
import { ALL_CARD_IDS, ALL_QUESTION_IDS, UNITS } from "@/lib/content";

const require = createRequire(import.meta.url);
const { validateUnit } = require("../scripts/workflow/content-rubric.js");

describe("generated content", () => {
  it("covers all seven units with 10 flashcards and 10 questions each", () => {
    expect(UNITS.map((u) => u.code)).toEqual(["F200", "F201", "F202", "F203", "F204", "F205", "F206"]);
    expect(ALL_CARD_IDS).toHaveLength(70);
    expect(ALL_QUESTION_IDS).toHaveLength(70);
    expect(new Set([...ALL_CARD_IDS, ...ALL_QUESTION_IDS]).size).toBe(140);
  });

  it.each(blueprint.units.map((u) => [u.code, u] as const))("%s passes the OCR examining rubric", (code, bpUnit) => {
    const unit = UNITS.find((u) => u.code === code);
    const { errors } = validateUnit(stripMerged(unit), bpUnit, blueprint);
    expect(errors).toEqual([]);
  });
});

/** UNITS merges blueprint fields in; the rubric validates the raw generated shape. */
function stripMerged(unit: (typeof UNITS)[number] | undefined) {
  if (!unit) return {};
  const { code, title, assessment, summary, flashcards, questions } = unit;
  return { code, title, assessment, summary, flashcards, questions };
}
