/**
 * Bundles the generated unit content so every page works offline. The JSON is produced by
 * the content-generator agent and approved by the ocr-examiner agent and the OCR rubric
 * (`node workflow.js`). tests/content.test.ts re-checks the rubric, so a malformed file
 * fails `npm test` before it can reach these casts.
 */

import blueprintJson from "@/content/blueprint.json";
import F200 from "@/content/units/F200.json";
import F201 from "@/content/units/F201.json";
import F202 from "@/content/units/F202.json";
import F203 from "@/content/units/F203.json";
import F204 from "@/content/units/F204.json";
import F205 from "@/content/units/F205.json";
import F206 from "@/content/units/F206.json";
import type { ExamQuestion, Flashcard, Unit, UnitBlueprint, UnitCode, UnitContent } from "./content-types";

export const BLUEPRINT = blueprintJson as { qualification: string; entryCodes: Record<string, string>; units: UnitBlueprint[] };

const CONTENT = [F200, F201, F202, F203, F204, F205, F206] as unknown as UnitContent[];

export const UNITS: Unit[] = BLUEPRINT.units.map((bp) => {
  const content = CONTENT.find((c) => c.code === bp.code);
  if (!content) throw new Error(`Missing content for ${bp.code}`);
  return { ...content, glh: bp.glh, assessmentDetail: bp.assessmentDetail, status: bp.status, topicAreas: bp.topicAreas };
});

export const UNIT_CODES = UNITS.map((u) => u.code);

const UNIT_BY_CODE = new Map(UNITS.map((u) => [u.code, u]));

export function isUnitCode(value: string): value is UnitCode {
  return UNIT_BY_CODE.has(value as UnitCode);
}

export function getUnit(code: string): Unit | undefined {
  return UNIT_BY_CODE.get(code.toUpperCase() as UnitCode);
}

export const CARD_INDEX = new Map<string, { card: Flashcard; unit: Unit }>(
  UNITS.flatMap((unit) => unit.flashcards.map((card) => [card.id, { card, unit }] as const)),
);

export const QUESTION_INDEX = new Map<string, { question: ExamQuestion; unit: Unit }>(
  UNITS.flatMap((unit) => unit.questions.map((question) => [question.id, { question, unit }] as const)),
);

export const ALL_CARD_IDS = UNITS.flatMap((u) => u.flashcards.map((c) => c.id));
export const ALL_QUESTION_IDS = UNITS.flatMap((u) => u.questions.map((q) => q.id));
export const QUESTION_MARKS: ReadonlyMap<string, number> = new Map(UNITS.flatMap((u) => u.questions.map((q) => [q.id, q.marks] as const)));

export function topicTitle(unit: Unit, topicArea: number): string {
  return unit.topicAreas.find((t) => t.id === topicArea)?.title ?? `Topic area ${topicArea}`;
}

/** Short labels for the radar chart axes. */
export const UNIT_SHORT_NAMES: Record<UnitCode, string> = {
  F200: "Fundamentals",
  F201: "Big data & ML",
  F202: "Spreadsheets",
  F203: "Databases",
  F204: "IoE",
  F205: "Visualisation",
  F206: "Digital marketing",
};
