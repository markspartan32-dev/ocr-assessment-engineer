/**
 * A transparent keyword estimate for self-marking. It shows which mark-scheme points an
 * answer probably touches and suggests a starting mark. It is deliberately conservative and
 * always labelled as an estimate: the student sets the final mark against the mark scheme.
 */

import type { ExamQuestion } from "./content-types";

const STOPWORDS = new Set(
  "about above after again against also although among another answer answers award because been before being below between both but candidate cannot could credit does doing down during each either example examples explain explains explained from further give gives have having here into identifies identify itself just level make makes mark marks more most much must need needs only other over point points response same should since some such than that their them then there these they this those through under until upon used uses using valid very well were what when where whether which while will with within would your".split(
    " ",
  ),
);

function stem(word: string): string {
  return word.replace(/(ations?|ings?|ed|es|s|ly)$/, "");
}

export function keywords(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/\(\d\)/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
  return new Set(words.map(stem).filter((w) => w.length >= 3));
}

/** For each mark-scheme point: does the answer share enough of its key words? */
export function matchPoints(answer: string, points: readonly string[]): boolean[] {
  const said = keywords(answer);
  return points.map((point) => {
    const wanted = [...keywords(point)];
    if (!wanted.length) return false;
    const hits = wanted.filter((w) => said.has(w)).length;
    return hits >= Math.min(3, Math.max(1, Math.ceil(wanted.length * 0.4)));
  });
}

/** A conservative starting mark from the matched points (the bottom of a band, for levels). */
export function suggestMarks(question: ExamQuestion, matches: readonly boolean[], answer: string): number {
  const matched = matches.filter(Boolean).length;
  const wordCount = answer.trim().split(/\s+/).filter(Boolean).length;
  if (!matched || wordCount < 3) return 0;
  const { markScheme, marks } = question;
  if (markScheme.type === "points" || !markScheme.levels?.length) return Math.min(marks, matched);

  const coverage = matched / Math.max(1, matches.length);
  const bands = [...markScheme.levels].sort((a, b) => b.level - a.level);
  const band = coverage >= 0.5 && wordCount >= marks * 10 ? bands[0] : coverage >= 0.25 ? bands[1] : bands[bands.length - 1];
  return band ? band.marks[0] : 0;
}
