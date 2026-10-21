'use strict';

/**
 * Pulls one unit's teaching content out of the OCR specification so the content-generator
 * and ocr-examiner agents work from the real "To include" / "Does not include" scope.
 *
 * The specification itself is not committed (it is OCR's copyright). Pass its path with
 * `--spec`; a PDF is converted with `pdftotext -layout` when that tool is installed.
 */

const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const NOISE = [/^Version \d+ \(.*\)\s+\d+\s+© Cambridge OCR \d{4}$/, /^Cambridge OCR Level 3 Alternative Academic Qualification/, /^© Cambridge OCR/];
const MAX_LINES_PER_UNIT = 900;

function readSpecText(specPath) {
  if (specPath.toLowerCase().endsWith('.pdf')) {
    const result = spawnSync('pdftotext', ['-layout', specPath, '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (result.error || result.status !== 0) {
      throw new Error(`Could not convert ${specPath} with pdftotext; pass a .txt export instead.`);
    }
    return result.stdout;
  }
  return fs.readFileSync(specPath, 'utf8');
}

/** Returns { F200: "…teaching content…", … } for every unit heading found in the text. */
function extractUnitSections(text) {
  const lines = text.split(/\r?\n/);
  const starts = [];
  lines.forEach((line, index) => {
    const match = /^\s*Unit (F20[0-6])\b/.exec(line);
    if (!match) return;
    // A teaching-content heading is followed by "Topic Area 1" within a few lines; the
    // contents page and the summary tables are not.
    const lookahead = lines.slice(index + 1, index + 4).join('\n');
    if (/Topic Area 1\b/.test(lookahead)) starts.push({ code: match[1], index });
  });

  const sections = {};
  starts.forEach((start, i) => {
    let end = i + 1 < starts.length ? starts[i + 1].index : lines.length;
    if (i + 1 === starts.length) {
      // The last unit runs until the next "Unit Fxxx" heading of any kind (the summary
      // section), so the rest of the document is not swept in.
      const next = lines.findIndex((line, j) => j > start.index + 5 && /^\s*Unit F20[0-6]\b/.test(line));
      if (next !== -1) end = next;
    }
    end = Math.min(end, start.index + MAX_LINES_PER_UNIT);
    sections[start.code] = lines
      .slice(start.index, end)
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter((line) => line && !NOISE.some((pattern) => pattern.test(line)))
      .join('\n');
  });
  return sections;
}

function loadSpecExcerpts(specPath) {
  if (!specPath) return {};
  return extractUnitSections(readSpecText(specPath));
}

module.exports = { loadSpecExcerpts, extractUnitSections };
