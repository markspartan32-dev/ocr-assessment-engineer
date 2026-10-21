# DataCommand

DataCommand is an offline-first, active-recall revision app for the **Cambridge OCR Level 3 Alternative Academic
Qualification Cambridge Advanced National in IT: Data Analytics** (Certificate H019 / Extended Certificate H119),
units **F200–F206**.

- **70 SM-2 flashcards**: SuperMemo-2 spaced repetition, the algorithm Anki descends from. You grade recall from 0
  to 5, and each button previews the interval it would schedule.
- **70 OCR-style exam questions**: they use the real Appendix A command words, with points-based and
  levels-of-response mark schemes (6-mark Analyse, 9-mark Discuss), model answers and a keyword self-marking aid.
- **Analytics**: a Recharts radar of mastery across all seven units, XP and review trend lines, and a 14-day
  forecast of when SM-2 brings cards back.
- **Gamification**: XP for correct recall, levels, daily streaks, a daily goal bonus and a Framer Motion level-up
  celebration.
- **Command palette (⌘K / Ctrl+K)**: jump to any page, unit, flashcard or question. **Focus Mode (⇧F)** hides
  everything except the current card.
- **Offline-first PWA**: progress lives in IndexedDB through localForage, and a service worker precaches every
  route. Nothing leaves the device.

## Quick start

```bash
npm install
npm run dev            # http://localhost:3000
npm run build && npm start
```

| Script | What it does |
| --- | --- |
| `npm test` | Vitest: SM-2, scheduler, store, gamification, import validation, marking, content rubric, auditor |
| `npm run typecheck` | `next typegen` followed by `tsc --noEmit` |
| `npm run lint` | ESLint with zero warnings allowed |
| `npm run workflow` | Offline quality gate (see below) |
| `npm run workflow:live` | The quality gate with the Claude Code subagents |
| `npm run workflow:self-test` | Proves the auto-fix loop on deliberately vulnerable fixtures |

## The agent swarm

`.claude/agents/` defines five Claude Code subagents. Each has its own context, tool allow-list and model:

| Agent | Role | Tools |
| --- | --- | --- |
| `content-generator` | Writes one unit's 10 flashcards and 10 exam questions as strict JSON, scoped to the specification's teaching content | Read, Glob, Grep |
| `ocr-examiner` | Principal-examiner review covering accuracy, scope, command-word demand, tariffs and mark-scheme style; returns the corrected unit and an issues log | Read, Glob, Grep |
| `srs-specialist` | Owns `src/lib/srs` (SM-2 and the session scheduler) and its invariant tests | Read, Write, Edit, Glob, Grep, Bash |
| `ui-ux-gamification` | Owns `src/app` and `src/components`, and applies UI fixes the auditor asks for | Read, Write, Edit, Glob, Grep, Bash |
| `security-qa-auditor` | **Read-only** XSS and accessibility audit of `src/app` and `src/components` | Read, Glob, Grep |

You can also use them interactively in Claude Code, for example: "use the ocr-examiner agent to review
src/content/units/F203.json".

## `workflow.js`: the quality gate

`workflow.js` orchestrates the swarm. Each agent runs headlessly as `claude -p --agent <name>` with JSON-schema
structured output, so it uses the agent's own prompt, tools and model.

```
Stage 0  swarm     every agent definition is present; the auditor is verifiably read-only
Stage 1  content   content-generator → deterministic OCR rubric → ocr-examiner (repair loop, max 3 rounds) → publish JSON
Stage 2  audit     TypeScript-AST scanner (+ the security-qa-auditor agent with --live) over src/app and src/components
Stage 3  auto-fix  while any HIGH finding remains: apply safe codemods, hand the rest to ui-ux-gamification, rescan
Stage 4  verify    typecheck, lint and unit tests, so a fix can never silently break the build
```

```bash
node workflow.js                                   # offline: rubric + scanner + verify
node workflow.js --live                            # + agent audit / agent fixes
node workflow.js --live --regenerate --spec spec.pdf --concurrency 7   # regenerate all content from the OCR spec
```

Pass `--spec` the OCR specification PDF (or a text export of it) to give the agents each unit's real "To include"
and "Does not include" scope. The specification is OCR's copyright, so it is not committed. Reports are written to
`.workflow/report.{json,md}`.

**Deterministic checks.** Agent output is never trusted unchecked:

- `scripts/workflow/content-rubric.js` enforces the content contract. That covers exactly 10 + 10 items, coverage
  of every topic area, OCR command words per assessment type, tariff bands per command word, levels-of-response
  bands (6 → 5–6/3–4/1–2, 9 → 7–9/4–6/1–3), the paper structure (F200 has two 6-markers; F201 has a 6- and a
  9-marker), model-answer depth, plain text only, and British spelling.
- `scripts/workflow/auditor.js` flags `dangerouslySetInnerHTML`, DOM HTML sinks, `eval`/`new Function`,
  `javascript:` URLs, hard-coded secrets, reverse tabnabbing, unnamed icon buttons and links, unlabelled form
  fields, images without `alt`, click handlers on non-interactive elements, dialogs without names, and positive
  `tabIndex`. Safe findings come with exact source edits. Findings the agent reports are kept only if the quoted
  evidence really exists at the cited line.

## How SM-2 works here

Every card stores a repetition count *n*, an ease factor *EF* (starting at 2.5) and an interval *I* in days.

- If you grade **q ≥ 3** (recalled), *I* becomes 1, then 6, then ⌈*I* × *EF*⌉, and *n* goes up by 1.
- If you grade **q < 3** (forgotten), *n* = 0 and *I* = 1. The card is relearned, but *EF* is kept.
- After every grade, *EF* ← max(1.3, *EF* + 0.1 − (5 − q)(0.08 + (5 − q)·0.02)). That is +0.10, 0, −0.14, −0.32,
  −0.54 or −0.80 for q = 5 … 0.
- Cards graded **below 4** come back later in the same session (SM-2 step 7). If you stop before re-drilling them,
  they lead your **next** session, even later the same day. These repeats never re-apply SM-2.
- **Practice** mode, offered when nothing is due, never touches the schedule.

The algorithm is in `src/lib/srs/sm2.ts`, which is pure and has no clock or storage access. The queueing,
repeats and forecast are in `src/lib/srs/scheduler.ts`. `tests/sm2.test.ts` and `tests/scheduler.test.ts`
pin the published behaviour.

## Architecture

```
src/
  app/                 App Router pages (all prerendered); manifest + security headers in next.config.ts
  components/          shell (nav, ⌘K, focus, SW), review, exam, charts, analytics, rewards, settings
  content/             blueprint.json (spec metadata), unit.schema.json, units/F200–F206.json
  lib/                 sm2, scheduler, gamification, mastery, marking, date maths, progress import validation
  store/               Zustand: progress (persisted to IndexedDB via localForage) and ephemeral UI state
public/sw.js           offline service worker (route + asset precache, network-first pages)
workflow.js            agent orchestration and quality gate
```

- **Offline.** Every route is prerendered. The service worker precaches route HTML and the hashed
  `/_next/static` assets those pages reference, and Next's `experimental.useOffline` keeps soft navigations
  pending while offline.
- **Security.** Content is rendered only as text. The app sends a strict same-origin CSP (with no nonces it has to
  allow inline scripts for the RSC payload), `X-Frame-Options: DENY`, `nosniff` and a locked-down
  `Permissions-Policy`. Imported backups are validated field by field before they reach the store.
- **Accessibility.** The app follows WCAG AA colour contrast, offers full keyboard control (⌘K, ⇧F, Space, 0–5,
  Esc), honours reduced motion everywhere, announces XP and level-ups in a live region, and gives every chart a
  text alternative plus a table view.

## Notes

- The stack is Next.js 16 (App Router with Cache Components), React 19, Tailwind v4, Zustand 5, Recharts 3,
  Framer Motion and localForage. The original brief named Next.js 14; `create-next-app@latest` now scaffolds 16,
  which keeps the same App Router model and is the supported release line.
- Server Actions are not used, on purpose. All progress stays on the device so the app works fully offline, which
  means there is nothing for a server mutation to do.
- Content was generated by the `content-generator` agent from the OCR specification's teaching content, then
  reviewed and corrected by the `ocr-examiner` agent and the deterministic rubric. It is revision material, not
  official OCR material. Always check against the current specification.
