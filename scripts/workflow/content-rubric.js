'use strict';

/**
 * Deterministic OCR examining rubric for DataCommand unit content.
 *
 * This is the machine-checkable half of the `ocr-examiner` agent's checklist: structure,
 * command words, tariffs, mark-scheme shape and specification coverage. The examiner agent
 * judges accuracy and quality; this module guarantees the contract so the app never ships
 * malformed content. Every rule is documented in .claude/agents/content-generator.md.
 */

const FLASHCARD_COUNT = 10;
const QUESTION_COUNT = 10;

/** Allowed mark range for each command word, plus whether the word demands a judgement. */
const TARIFFS = {
  Choose: [1, 4],
  Identify: [1, 4],
  State: [1, 4],
  Label: [1, 4],
  Complete: [1, 4],
  Annotate: [1, 4],
  'Give examples': [1, 4],
  Outline: [1, 4],
  Classify: [1, 4],
  Draw: [1, 4],
  Calculate: [1, 4],
  Describe: [2, 4],
  Summarise: [2, 4],
  Explain: [2, 6],
  Compare: [2, 6],
  Examine: [2, 6],
  Interpret: [2, 6],
  Analyse: [4, 6],
  Discuss: [6, 9],
  Evaluate: [6, 9],
  Assess: [6, 9],
  Justify: [6, 9],
  Conclude: [2, 6],
  Investigate: [4, 9],
  Research: [2, 6],
  Adapt: [2, 6],
};

/** Levels-of-response bands OCR uses for its extended responses. */
const LEVEL_BANDS = {
  6: [[5, 6], [3, 4], [1, 2]],
  9: [[7, 9], [4, 6], [1, 3]],
};

const AMERICAN_SPELLINGS = {
  analyze: 'analyse', analyzed: 'analysed', analyzing: 'analysing', analyzes: 'analyses',
  organization: 'organisation', organizations: 'organisations', organize: 'organise',
  organized: 'organised', visualization: 'visualisation', visualizations: 'visualisations',
  visualize: 'visualise', color: 'colour', colors: 'colours', behavior: 'behaviour',
  behaviors: 'behaviours', optimize: 'optimise', optimization: 'optimisation',
  prioritize: 'prioritise', summarize: 'summarise', categorize: 'categorise',
  utilize: 'utilise', catalog: 'catalogue', defense: 'defence', favor: 'favour',
  modeling: 'modelling', labeled: 'labelled', center: 'centre', centers: 'centres',
  customize: 'customise', customized: 'customised', standardize: 'standardise',
  minimize: 'minimise', maximize: 'maximise', recognize: 'recognise', anonymize: 'anonymise',
  anonymized: 'anonymised', pseudonymize: 'pseudonymise', authorize: 'authorise',
  authorized: 'authorised', unauthorized: 'unauthorised',
};

const HTML_TAG = /<\/?[a-z][a-z0-9-]*(\s[^>]*)?>/i;
const MARKDOWN = /(\*\*[^*]+\*\*|```|^#{1,6}\s|\[[^\]]+\]\([^)]+\))/m;

const words = (text) => (typeof text === 'string' ? text.trim().split(/\s+/).filter(Boolean).length : 0);
const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;
const pad = (n) => String(n).padStart(2, '0');

/**
 * Validate one unit against its blueprint entry.
 * @returns {{ code: string, errors: Issue[], warnings: Issue[], stats: object }}
 * where Issue = { rule: string, id?: string, message: string }
 */
function validateUnit(unit, blueprintUnit, blueprint) {
  const errors = [];
  const warnings = [];
  const error = (rule, message, id) => errors.push({ rule, message, ...(id ? { id } : {}) });
  const warn = (rule, message, id) => warnings.push({ rule, message, ...(id ? { id } : {}) });
  const code = blueprintUnit.code;
  const topicIds = new Set(blueprintUnit.topicAreas.map((t) => t.id));

  if (!unit || typeof unit !== 'object' || Array.isArray(unit)) {
    error('structure/object', 'Unit content must be a JSON object.');
    return { code, errors, warnings, stats: {} };
  }

  // ---- Unit-level structure -------------------------------------------------------------
  const allowedKeys = new Set(['code', 'title', 'assessment', 'summary', 'flashcards', 'questions']);
  for (const key of Object.keys(unit)) {
    if (!allowedKeys.has(key)) error('structure/unknown-key', `Unexpected top-level key "${key}".`);
  }
  if (unit.code !== code) error('structure/code', `code must be "${code}" (got ${JSON.stringify(unit.code)}).`);
  if (unit.title !== blueprintUnit.title) error('structure/title', `title must match the blueprint: "${blueprintUnit.title}".`);
  if (unit.assessment !== blueprintUnit.assessment) {
    error('structure/assessment', `assessment must be "${blueprintUnit.assessment}".`);
  }
  if (!isNonEmptyString(unit.summary)) error('structure/summary', 'summary is required.');

  const flashcards = Array.isArray(unit.flashcards) ? unit.flashcards : [];
  const questions = Array.isArray(unit.questions) ? unit.questions : [];
  if (!Array.isArray(unit.flashcards)) error('structure/flashcards', 'flashcards must be an array.');
  if (!Array.isArray(unit.questions)) error('structure/questions', 'questions must be an array.');
  if (flashcards.length !== FLASHCARD_COUNT) {
    error('structure/flashcard-count', `Expected exactly ${FLASHCARD_COUNT} flashcards, found ${flashcards.length}.`);
  }
  if (questions.length !== QUESTION_COUNT) {
    error('structure/question-count', `Expected exactly ${QUESTION_COUNT} questions, found ${questions.length}.`);
  }

  // ---- Text hygiene, shared by every string field ---------------------------------------
  const checkText = (value, field, id) => {
    if (!isNonEmptyString(value)) {
      error('text/required', `${field} must be a non-empty string.`, id);
      return;
    }
    if (HTML_TAG.test(value)) error('text/no-html', `${field} contains HTML markup; content must be plain text.`, id);
    if (MARKDOWN.test(value)) error('text/no-markdown', `${field} contains Markdown; content must be plain text.`, id);
    for (const match of value.matchAll(/[A-Za-z]+/g)) {
      const british = AMERICAN_SPELLINGS[match[0].toLowerCase()];
      if (british) warn('style/british-english', `${field}: use "${british}" instead of "${match[0]}".`, id);
    }
  };
  checkText(unit.summary, 'summary');

  // ---- Flashcards -------------------------------------------------------------------------
  const seenFronts = new Set();
  flashcards.forEach((card, index) => {
    const expectedId = `${code}-FC${pad(index + 1)}`;
    const id = card && card.id;
    if (!card || typeof card !== 'object') {
      error('flashcard/object', `Flashcard ${index + 1} must be an object.`);
      return;
    }
    if (id !== expectedId) error('flashcard/id', `Flashcard ${index + 1} must have id "${expectedId}" (got ${JSON.stringify(id)}).`, id);
    if (!topicIds.has(card.topicArea)) error('flashcard/topic-area', `topicArea ${JSON.stringify(card.topicArea)} is not a ${code} topic area.`, id);
    checkText(card.front, 'front', id);
    checkText(card.back, 'back', id);
    if (isNonEmptyString(card.front)) {
      if (card.front.length > 220) error('flashcard/front-length', `front is ${card.front.length} characters (max 220).`, id);
      const key = card.front.trim().toLowerCase();
      if (seenFronts.has(key)) error('flashcard/duplicate', 'Duplicate flashcard front.', id);
      seenFronts.add(key);
    }
    const backWords = words(card.back);
    if (backWords && (backWords < 8 || backWords > 120)) {
      error('flashcard/back-length', `back is ${backWords} words (must be 8–120; aim for 15–90).`, id);
    } else if (backWords && (backWords < 15 || backWords > 90)) {
      warn('flashcard/back-length', `back is ${backWords} words (aim for 15–90).`, id);
    }
    if (!Array.isArray(card.keyTerms) || card.keyTerms.length < 1 || card.keyTerms.length > 4 || !card.keyTerms.every(isNonEmptyString)) {
      error('flashcard/key-terms', 'keyTerms must contain 1–4 non-empty strings.', id);
    }
  });

  // ---- Questions --------------------------------------------------------------------------
  const allowedCommandWords = new Set(
    blueprintUnit.assessment === 'exam'
      ? blueprint.examCommandWords
      : [...blueprint.examCommandWords, ...blueprint.neaCommandWords],
  );
  let previousMarks = 0;
  questions.forEach((q, index) => {
    const expectedId = `${code}-Q${pad(index + 1)}`;
    const id = q && q.id;
    if (!q || typeof q !== 'object') {
      error('question/object', `Question ${index + 1} must be an object.`);
      return;
    }
    if (id !== expectedId) error('question/id', `Question ${index + 1} must have id "${expectedId}" (got ${JSON.stringify(id)}).`, id);
    if (!topicIds.has(q.topicArea)) error('question/topic-area', `topicArea ${JSON.stringify(q.topicArea)} is not a ${code} topic area.`, id);
    checkText(q.question, 'question', id);
    checkText(q.modelAnswer, 'modelAnswer', id);
    if (q.context !== undefined) {
      checkText(q.context, 'context', id);
      if (words(q.context) > 80) warn('question/context-length', `context is ${words(q.context)} words (aim for under 60).`, id);
    }

    const marks = q.marks;
    if (!Number.isInteger(marks) || marks < 1 || marks > 9) {
      error('question/marks', `marks must be an integer from 1 to 9 (got ${JSON.stringify(marks)}).`, id);
      return;
    }
    if (marks < previousMarks) warn('question/order', 'Questions should be ordered by ascending marks.', id);
    previousMarks = marks;

    // Command word: allowed for this unit, opens the question, and matches the tariff.
    const commandWord = q.commandWord;
    if (!allowedCommandWords.has(commandWord)) {
      const list = blueprintUnit.assessment === 'exam' ? 'exam (Appendix A)' : 'exam or NEA (Appendix A)';
      error('question/command-word', `"${commandWord}" is not an OCR ${list} command word.`, id);
    } else {
      if (isNonEmptyString(q.question) && !q.question.trim().toLowerCase().startsWith(commandWord.toLowerCase())) {
        error('question/command-word-position', `question must begin with its command word "${commandWord}".`, id);
      }
      const band = TARIFFS[commandWord];
      if (band && (marks < band[0] || marks > band[1])) {
        error('question/tariff', `"${commandWord}" questions should be worth ${band[0]}–${band[1]} marks (got ${marks}).`, id);
      }
    }

    // Mark scheme shape.
    const ms = q.markScheme;
    if (!ms || typeof ms !== 'object') {
      error('markscheme/object', 'markScheme is required.', id);
      return;
    }
    const points = Array.isArray(ms.points) ? ms.points : [];
    points.forEach((p, i) => checkText(p, `markScheme.points[${i}]`, id));
    if (ms.guidance !== undefined) checkText(ms.guidance, 'markScheme.guidance', id);
    const expectedType = marks >= 6 ? 'levels' : 'points';
    if (ms.type !== expectedType) {
      error('markscheme/type', `A ${marks}-mark question needs a "${expectedType}" mark scheme (got ${JSON.stringify(ms.type)}).`, id);
    }
    if (ms.type === 'points') {
      if (points.length < marks) error('markscheme/points-count', `Points-based scheme lists ${points.length} creditworthy points for ${marks} marks.`, id);
      if (points.some((p) => typeof p === 'string' && !/\(\d\)\s*$/.test(p.trim()))) {
        warn('markscheme/point-marks', 'Each creditworthy point should end with its mark value, e.g. "(1)".', id);
      }
      if (ms.levels !== undefined) error('markscheme/levels-unexpected', 'Points-based schemes must not include levels.', id);
    }
    if (ms.type === 'levels') {
      if (points.length < 4) error('markscheme/indicative-content', `Levels scheme needs at least 5 indicative points (found ${points.length}).`, id);
      else if (points.length < 5) warn('markscheme/indicative-content', 'Levels scheme should have at least 5 indicative points.', id);
      const levels = Array.isArray(ms.levels) ? ms.levels : [];
      const expected = LEVEL_BANDS[marks];
      if (!expected) {
        error('markscheme/levels-tariff', `Levels-of-response questions must be worth 6 or 9 marks (got ${marks}).`, id);
      } else {
        const actual = levels.map((l) => (Array.isArray(l && l.marks) ? l.marks : []));
        const ok = levels.length === expected.length
          && levels.every((l, i) => l.level === expected.length - i)
          && actual.every((band, i) => band[0] === expected[i][0] && band[1] === expected[i][1]);
        if (!ok) {
          const want = expected.map((b, i) => `L${expected.length - i} ${b[0]}–${b[1]}`).join(', ');
          error('markscheme/levels-bands', `Levels must be ${want}, ordered highest first.`, id);
        }
        levels.forEach((l, i) => checkText(l && l.descriptor, `markScheme.levels[${i}].descriptor`, id));
      }
    }

    // Model answer depth.
    const answerWords = words(q.modelAnswer);
    const target = marks * (ms.type === 'levels' ? 12 : 8);
    if (ms.type === 'levels' && answerWords < marks * 8) {
      error('question/model-answer-depth', `Model answer is ${answerWords} words; a ${marks}-mark answer needs at least ${target}.`, id);
    } else if (answerWords && answerWords < target) {
      warn('question/model-answer-depth', `Model answer is ${answerWords} words; aim for at least ${target}.`, id);
    }
  });

  // ---- Paper composition ------------------------------------------------------------------
  for (const topic of blueprintUnit.topicAreas) {
    if (!flashcards.some((c) => c && c.topicArea === topic.id)) {
      error('coverage/flashcards', `No flashcard covers topic area ${topic.id} (${topic.title}).`);
    }
    if (!questions.some((q) => q && q.topicArea === topic.id)) {
      error('coverage/questions', `No question covers topic area ${topic.id} (${topic.title}).`);
    }
  }
  const valid = questions.filter((q) => q && Number.isInteger(q.marks));
  const short = valid.filter((q) => q.marks <= 4).length;
  if (short < 4) error('composition/short-answer', `Needs at least 4 short questions worth 1–4 marks (found ${short}).`);
  const sixMark = valid.filter((q) => q.marks === 6 && q.markScheme && q.markScheme.type === 'levels');
  const nineMark = valid.filter((q) => q.marks === 9 && q.markScheme && q.markScheme.type === 'levels');
  const { sixMark: needSix, nineMark: needNine } = blueprintUnit.extendedResponse;
  if (sixMark.length < needSix) error('composition/six-mark', `Needs ${needSix} six-mark levels-of-response question(s) (found ${sixMark.length}).`);
  if (nineMark.length < needNine) error('composition/nine-mark', `Needs ${needNine} nine-mark levels-of-response question(s) (found ${nineMark.length}).`);
  if (needNine === 0 && valid.some((q) => q.marks > 6)) {
    error('composition/max-tariff', `${code}'s exam has no extended response above 6 marks.`);
  }
  if (blueprintUnit.assessment === 'nea') {
    if (!sixMark.some((q) => q.commandWord === 'Analyse')) error('composition/analyse', 'NEA units need a 6-mark "Analyse" question.');
    if (!nineMark.some((q) => q.commandWord === 'Discuss' || q.commandWord === 'Evaluate')) {
      error('composition/discuss', 'NEA units need a 9-mark "Discuss" or "Evaluate" question.');
    }
  }

  const stats = {
    flashcards: flashcards.length,
    questions: questions.length,
    totalMarks: valid.reduce((sum, q) => sum + q.marks, 0),
    commandWords: [...new Set(valid.map((q) => q.commandWord))].sort(),
    extendedResponses: { sixMark: sixMark.length, nineMark: nineMark.length },
  };
  return { code, errors, warnings, stats };
}

module.exports = { validateUnit, TARIFFS, LEVEL_BANDS, FLASHCARD_COUNT, QUESTION_COUNT };
