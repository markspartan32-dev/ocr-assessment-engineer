/** Shapes of the generated content in src/content (contract: src/content/unit.schema.json). */

export type UnitCode = "F200" | "F201" | "F202" | "F203" | "F204" | "F205" | "F206";
export type Assessment = "exam" | "nea";

export interface TopicArea {
  id: number;
  title: string;
}

export interface UnitBlueprint {
  code: UnitCode;
  title: string;
  glh: number;
  assessment: Assessment;
  assessmentDetail: string;
  status: { certificate: string; extendedCertificate: string };
  extendedResponse: { sixMark: number; nineMark: number };
  topicAreas: TopicArea[];
}

export interface Flashcard {
  id: string;
  topicArea: number;
  front: string;
  back: string;
  keyTerms: string[];
}

export interface LevelBand {
  level: number;
  marks: [number, number];
  descriptor: string;
}

export interface MarkScheme {
  type: "points" | "levels";
  points: string[];
  levels?: LevelBand[];
  guidance?: string;
}

export interface ExamQuestion {
  id: string;
  topicArea: number;
  commandWord: string;
  marks: number;
  context?: string;
  question: string;
  markScheme: MarkScheme;
  modelAnswer: string;
}

export interface UnitContent {
  code: UnitCode;
  title: string;
  assessment: Assessment;
  summary: string;
  flashcards: Flashcard[];
  questions: ExamQuestion[];
}

export interface Unit extends UnitContent {
  glh: number;
  assessmentDetail: string;
  status: UnitBlueprint["status"];
  topicAreas: TopicArea[];
}
