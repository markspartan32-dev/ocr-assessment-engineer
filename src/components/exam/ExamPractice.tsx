"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, ClipboardCheck, Info, Lightbulb, Save } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";
import { COMMAND_WORD_MEANINGS } from "@/lib/command-words";
import { getUnit, topicTitle } from "@/lib/content";
import { focusSoon, hashId } from "@/lib/dom";
import type { ExamQuestion, UnitCode } from "@/lib/content-types";
import { matchPoints, suggestMarks } from "@/lib/marking";
import { useStudyReady } from "@/hooks/useStudy";
import { useProgress } from "@/store/progress";
import { celebrate, useUi } from "@/store/ui";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { AssessmentBadge, UnitCode as Code } from "@/components/ui/UnitTag";

function MarkScheme({ question, matches }: { question: ExamQuestion; matches: boolean[] }) {
  const { markScheme } = question;
  return (
    <section aria-labelledby={`${question.id}-ms`} className="card space-y-5 p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <ClipboardCheck aria-hidden="true" className="size-5 text-accent" />
        <h3 id={`${question.id}-ms`} tabIndex={-1} className="font-semibold outline-none">
          Mark scheme · {markScheme.type === "levels" ? "levels of response" : "points-based"}
        </h3>
      </div>
      <div>
        <p className="eyebrow mb-2">{markScheme.type === "levels" ? "Indicative content" : "Creditworthy points"}</p>
        <ul className="space-y-2">
          {markScheme.points.map((point, i) => (
            <li key={i} className="flex gap-3 text-sm leading-6">
              <span
                className={`mt-1 grid size-5 shrink-0 place-items-center rounded-full border ${matches[i] ? "border-ok/60 bg-ok/15 text-ok" : "border-line-strong text-transparent"}`}
                aria-hidden="true"
              >
                <Check className="size-3" />
              </span>
              <span className="text-fg-muted">
                {point}
                {matches[i] && <span className="ml-2 text-xs font-medium text-ok">likely covered</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>
      {markScheme.levels && (
        <div>
          <p className="eyebrow mb-2">Levels</p>
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Levels of response for {question.marks} marks</caption>
            <thead>
              <tr className="text-xs text-fg-subtle">
                <th scope="col" className="pb-2 pr-4 font-medium">Level</th>
                <th scope="col" className="pb-2 pr-4 font-medium">Marks</th>
                <th scope="col" className="pb-2 font-medium">Descriptor</th>
              </tr>
            </thead>
            <tbody>
              {markScheme.levels.map((band) => (
                <tr key={band.level} className="border-t border-line align-top">
                  <th scope="row" className="py-3 pr-4 font-mono font-semibold">L{band.level}</th>
                  <td className="py-3 pr-4 font-mono text-fg-muted">{band.marks[0]}–{band.marks[1]}</td>
                  <td className="py-3 leading-6 text-fg-muted">{band.descriptor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {markScheme.guidance && (
        <p className="flex gap-2 rounded-xl bg-surface-2 p-3 text-sm leading-6 text-fg-muted">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-violet" />
          <span>
            <span className="font-semibold text-fg">Examiner guidance: </span>
            {markScheme.guidance}
          </span>
        </p>
      )}
      <details className="group rounded-xl border border-line p-4">
        <summary className="cursor-pointer text-sm font-semibold text-accent">Show the model answer</summary>
        <p className="mt-3 text-sm leading-7 whitespace-pre-line text-fg-muted">{question.modelAnswer}</p>
      </details>
    </section>
  );
}

function SelfMark({ question, suggested, onSave }: { question: ExamQuestion; suggested: number; onSave: (marks: number) => void }) {
  const [marks, setMarks] = useState(suggested);
  const name = useId();
  const values = Array.from({ length: question.marks + 1 }, (_, i) => i);
  return (
    <div className="card p-5 sm:p-6">
      <fieldset>
        <legend className="font-semibold">Mark your answer</legend>
        <p className="mt-1 text-sm text-fg-muted">
          Keyword estimate: <span className="font-mono font-semibold text-fg">{suggested}</span>/{question.marks}. This is a starting point only; judge your answer against the mark scheme.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {values.map((v) => (
            <label key={v} className="relative">
              <input type="radio" name={name} value={v} checked={marks === v} onChange={() => setMarks(v)} className="peer sr-only" aria-label={`${v} mark${v === 1 ? "" : "s"}`} />
              <span
                aria-hidden="true"
                className="grid size-11 cursor-pointer place-items-center rounded-xl border border-line-strong bg-surface-2 font-mono text-sm font-semibold text-fg-muted transition-colors peer-checked:border-accent peer-checked:bg-accent peer-checked:text-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent hover:text-fg"
              >
                {v}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <button type="button" onClick={() => onSave(marks)} className="btn btn-primary mt-5">
        <Save aria-hidden="true" className="size-4" /> Save {marks}/{question.marks}
      </button>
    </div>
  );
}

export function ExamPractice({ unitCode }: { unitCode: UnitCode }) {
  const unit = getUnit(unitCode)!;
  const today = useStudyReady();
  const exams = useProgress((s) => s.exams);
  const focusMode = useUi((s) => s.focusMode);
  const [selected, setSelected] = useState(unit.questions[0].id);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  /** The answer as it stood when the mark scheme was revealed; the keyword estimate uses this snapshot. */
  const [markedAnswer, setMarkedAnswer] = useState<Record<string, string>>({});
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const answerId = useId();
  const countId = useId();

  // Deep links from the command palette and unit pages: /exam/F200#F200-Q03
  useEffect(() => {
    const pick = () => {
      const id = hashId();
      if (id && unit.questions.some((q) => q.id === id)) setSelected(id);
    };
    pick();
    window.addEventListener("hashchange", pick);
    return () => window.removeEventListener("hashchange", pick);
  }, [unit]);

  const index = unit.questions.findIndex((q) => q.id === selected);
  const question = unit.questions[index];
  const answer = answers[question.id] ?? "";
  const snapshot = markedAnswer[question.id];
  const isRevealed = snapshot !== undefined;
  const matches = useMemo(() => (snapshot !== undefined ? matchPoints(snapshot, question.markScheme.points) : []), [snapshot, question]);
  const suggested = useMemo(() => (snapshot !== undefined ? suggestMarks(question, matches, snapshot) : 0), [snapshot, question, matches]);
  const markAnswer = () => {
    setMarkedAnswer((m) => ({ ...m, [question.id]: answer }));
    // The button that was pressed disappears; take the student to the mark scheme it revealed.
    focusSoon(`${question.id}-ms`);
  };
  const words = answer.trim().split(/\s+/).filter(Boolean).length;
  const record = exams[question.id];

  const select = (id: string, moveFocus = false) => {
    setSelected(id);
    setSavedNote(null);
    window.history.replaceState(null, "", `#${id}`);
    if (moveFocus) focusSoon(`${id}-q`);
  };

  const save = (marks: number) => {
    const reward = useProgress.getState().recordExam(question.id, marks, question.marks);
    const note = reward.improved ? `New best: ${marks}/${question.marks}` : `Saved ${marks}/${question.marks} (best ${Math.max(marks, record?.best ?? 0)})`;
    if (reward.xp > 0) celebrate(reward, note);
    else useUi.getState().announce(note);
    setSavedNote(note);
  };

  if (!today) return <PageSkeleton label="Loading exam practice" />;

  return (
    <div className={focusMode ? "" : "grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]"}>
      {!focusMode && (
        <aside aria-label={`${unit.code} questions`}>
          <div className="mb-4">
            <div className="flex items-center gap-2">
              <Code code={unit.code} />
              <AssessmentBadge assessment={unit.assessment} />
            </div>
            <h1 className="mt-2 text-xl font-semibold tracking-tight">{unit.title}</h1>
            <p className="mt-1 text-xs text-fg-muted">{unit.assessmentDetail}</p>
          </div>
          <ol className="space-y-1.5">
            {unit.questions.map((q, i) => {
              const r = exams[q.id];
              const active = q.id === selected;
              return (
                <li key={q.id}>
                  <button
                    type="button"
                    onClick={() => select(q.id)}
                    aria-current={active ? "true" : undefined}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm transition-colors ${active ? "border-accent/50 bg-accent/10" : "border-transparent hover:bg-surface-2"}`}
                  >
                    <span className="w-5 font-mono text-xs text-fg-subtle">{i + 1}</span>
                    <span className="flex-1">
                      <span className="block font-medium">{q.commandWord}</span>
                      <span className="block text-xs text-fg-subtle">{q.marks} mark{q.marks === 1 ? "" : "s"}</span>
                    </span>
                    {r ? (
                      <span className={`rounded-md px-1.5 py-0.5 font-mono text-xs font-semibold ${r.best === r.max ? "bg-ok/15 text-ok" : "bg-surface-3 text-fg-muted"}`}>
                        {r.best}/{r.max}
                      </span>
                    ) : (
                      <span className="sr-only">Not attempted</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>
      )}

      <div className="min-w-0 space-y-5">
        <AnimatePresence mode="wait" initial={false}>
          <motion.article
            key={question.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.16 }}
            className="card p-5 sm:p-7"
            aria-labelledby={`${question.id}-q`}
          >
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-mono text-fg-subtle">{question.id}</span>
              <span className="rounded-full border border-violet/40 bg-violet/10 px-2 py-0.5 font-medium text-violet">{question.commandWord}</span>
              <span className="text-fg-muted">{topicTitle(unit, question.topicArea)}</span>
              <span className="ml-auto font-mono font-semibold text-fg">[{question.marks} mark{question.marks === 1 ? "" : "s"}]</span>
            </div>
            {question.context && (
              <p className="mt-5 rounded-xl border-l-2 border-accent/60 bg-surface-2 px-4 py-3 text-sm leading-6 text-fg-muted">{question.context}</p>
            )}
            <h2 id={`${question.id}-q`} tabIndex={-1} className="mt-5 text-lg font-semibold leading-relaxed outline-none sm:text-xl">
              {question.question}
            </h2>
            {COMMAND_WORD_MEANINGS[question.commandWord] && (
              <p className="mt-3 flex gap-2 text-sm text-fg-muted">
                <Lightbulb aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-xp" />
                <span>
                  <span className="font-semibold text-fg">{question.commandWord}</span> means: {COMMAND_WORD_MEANINGS[question.commandWord]}
                </span>
              </p>
            )}
            <label htmlFor={answerId} className="mt-6 block text-sm font-semibold">
              Your answer
            </label>
            <textarea
              id={answerId}
              value={answer}
              onChange={(e) => setAnswers((a) => ({ ...a, [question.id]: e.target.value }))}
              rows={Math.min(10, 3 + question.marks)}
              placeholder="Write your answer as you would in the exam…"
              aria-describedby={countId}
              className="mt-2 w-full resize-y rounded-xl border border-line-strong bg-canvas/60 p-4 text-[0.95rem] leading-7 text-fg outline-none transition-colors placeholder:text-fg-subtle focus:border-accent"
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-fg-subtle">
              <span id={countId}>
                {words} word{words === 1 ? "" : "s"} · aim for about {question.marks * (question.markScheme.type === "levels" ? 25 : 15)}
              </span>
              {record && <span>Best so far: {record.best}/{record.max} · {record.attempts} attempt{record.attempts === 1 ? "" : "s"}</span>}
            </div>
            {!isRevealed ? (
              <button type="button" onClick={markAnswer} className="btn btn-primary mt-5">
                <ClipboardCheck aria-hidden="true" className="size-4" /> {answer.trim() ? "Mark my answer" : "Show the mark scheme"}
              </button>
            ) : (
              answer !== snapshot && (
                <button type="button" onClick={markAnswer} className="btn btn-ghost mt-5">
                  <ClipboardCheck aria-hidden="true" className="size-4" /> Re-mark my edited answer
                </button>
              )
            )}
          </motion.article>
        </AnimatePresence>

        {isRevealed && (
          <>
            <MarkScheme question={question} matches={matches} />
            <SelfMark key={`${question.id}:${snapshot}`} question={question} suggested={suggested} onSave={save} />
            {savedNote && (
              <p role="status" className="text-sm font-medium text-ok">
                {savedNote}
              </p>
            )}
          </>
        )}

        <nav aria-label="Question navigation" className="flex items-center justify-between gap-2">
          <button type="button" className="btn btn-ghost" disabled={index === 0} onClick={() => select(unit.questions[index - 1].id, true)}>
            <ChevronLeft aria-hidden="true" className="size-4" /> Previous
          </button>
          <Link href={`/review/${unit.code}`} className="text-sm text-fg-muted underline-offset-4 hover:text-fg hover:underline">
            Review {unit.code} flashcards
          </Link>
          <button type="button" className="btn btn-ghost" disabled={index === unit.questions.length - 1} onClick={() => select(unit.questions[index + 1].id, true)}>
            Next <ChevronRight aria-hidden="true" className="size-4" />
          </button>
        </nav>
      </div>
    </div>
  );
}
