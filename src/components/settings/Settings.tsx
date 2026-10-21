"use client";

import { Download, RotateCcw, Upload } from "lucide-react";
import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { useShallow } from "zustand/react/shallow";
import { ALL_CARD_IDS, ALL_QUESTION_IDS } from "@/lib/content";
import { toDayKey } from "@/lib/date";
import { exportProgress, parseProgressFile, SETTINGS_LIMITS, type ProgressData } from "@/lib/progress-schema";
import { useProgress, useProgressHydrated } from "@/store/progress";
import { useUi } from "@/store/ui";
import { Dialog } from "@/components/ui/Dialog";
import { PageSkeleton } from "@/components/ui/Skeleton";

const CARD_IDS = new Set(ALL_CARD_IDS);
const QUESTION_IDS = new Set(ALL_QUESTION_IDS);

function NumberSetting({ label, help, value, limits, onChange }: { label: string; help: string; value: number; limits: readonly [number, number]; onChange: (v: number) => void }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <label htmlFor={id} className="text-sm font-semibold">{label}</label>
        <p id={`${id}-help`} className="mt-0.5 text-xs text-fg-muted">{help}</p>
      </div>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={limits[0]}
        max={limits[1]}
        value={value}
        aria-describedby={`${id}-help`}
        onChange={(e) => e.target.value !== "" && onChange(Number(e.target.value))}
        className="w-28 rounded-xl border border-line-strong bg-canvas/60 px-3 py-2 font-mono text-sm outline-none focus:border-accent"
      />
    </div>
  );
}

export function Settings() {
  const hydrated = useProgressHydrated();
  const { settings, updateSettings, resetProgress, replaceProgress } = useProgress(
    useShallow((s) => ({ settings: s.settings, updateSettings: s.updateSettings, resetProgress: s.resetProgress, replaceProgress: s.replaceProgress })),
  );
  const [resetOpen, setResetOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<ProgressData | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const fileId = useId();

  // The command palette's "Reset progress…" links to /settings#reset.
  useEffect(() => {
    const check = () => window.location.hash === "#reset" && setResetOpen(true);
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, []);

  const closeReset = () => {
    setResetOpen(false);
    if (window.location.hash === "#reset") window.history.replaceState(null, "", window.location.pathname);
  };

  const download = () => {
    const state = useProgress.getState();
    const data: ProgressData = { cards: state.cards, exams: state.exams, xp: state.xp, streak: state.streak, daily: state.daily, log: state.log, settings: state.settings };
    const url = URL.createObjectURL(new Blob([JSON.stringify(exportProgress(data), null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `datacommand-progress-${toDayKey()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage({ tone: "ok", text: "Backup downloaded." });
  };

  const readFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const result = parseProgressFile(await file.text(), CARD_IDS, QUESTION_IDS);
    if (result.ok) setPendingImport(result.data);
    else setMessage({ tone: "bad", text: `Import failed: ${result.error}` });
  };

  if (!hydrated) return <PageSkeleton label="Loading settings" />;

  return (
    <div className="space-y-6">
      <section aria-labelledby="study-settings" className="card space-y-6 p-6">
        <h2 id="study-settings" className="font-semibold">Study settings</h2>
        <NumberSetting
          label="Daily review goal"
          help="Card reviews that complete your daily goal (+25 XP bonus)."
          value={settings.dailyGoal}
          limits={SETTINGS_LIMITS.dailyGoal}
          onChange={(dailyGoal) => updateSettings({ dailyGoal })}
        />
        <NumberSetting
          label="New cards per day"
          help="How many unseen flashcards SM-2 introduces each day, across all units."
          value={settings.newCardsPerDay}
          limits={SETTINGS_LIMITS.newCardsPerDay}
          onChange={(newCardsPerDay) => updateSettings({ newCardsPerDay })}
        />
      </section>

      <section aria-labelledby="data-settings" className="card space-y-4 p-6">
        <h2 id="data-settings" className="font-semibold">Your data</h2>
        <p className="text-sm leading-6 text-fg-muted">
          Progress is stored only on this device, in IndexedDB. Nothing is sent to a server. Download a backup to move it to another device.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={download} className="btn btn-ghost">
            <Download aria-hidden="true" className="size-4" /> Export backup
          </button>
          <label htmlFor={fileId} className="btn btn-ghost cursor-pointer focus-within:outline-2 focus-within:outline-accent">
            <Upload aria-hidden="true" className="size-4" /> Import backup
            <input ref={fileInput} id={fileId} type="file" accept="application/json,.json" onChange={readFile} className="sr-only" />
          </label>
        </div>
        {message && (
          <p role="status" className={`text-sm ${message.tone === "ok" ? "text-ok" : "text-bad"}`}>
            {message.text}
          </p>
        )}
      </section>

      <section aria-labelledby="danger" className="card space-y-4 border-bad/30 p-6">
        <h2 id="danger" className="font-semibold text-bad">Reset progress</h2>
        <p className="text-sm leading-6 text-fg-muted">
          Wipe every card schedule, exam score, XP, level and streak. This is handy for demos. Your study settings are kept.
        </p>
        <button type="button" onClick={() => setResetOpen(true)} className="btn btn-danger">
          <RotateCcw aria-hidden="true" className="size-4" /> Reset progress…
        </button>
      </section>

      <section aria-labelledby="sm2" className="card space-y-3 p-6 text-sm leading-6 text-fg-muted">
        <h2 id="sm2" className="font-semibold text-fg">How scheduling works (SM-2)</h2>
        <p>
          After each card you grade your recall from 0 (blackout) to 5 (perfect). A grade of 3 or more counts as correct: the first interval is 1 day, the second is 6 days,
          and after that each interval is multiplied by the card&apos;s ease factor (EF, starting at 2.5). A grade below 3 restarts the card at 1 day.
        </p>
        <p>
          The EF changes after every grade by 0.1 − (5 − q)(0.08 + (5 − q) × 0.02), so easy cards drift further apart and hard ones come back sooner. It never drops below 1.3.
          Cards graded below 4 are repeated later in the same session. If you stop before getting them right, they open your next session.
        </p>
      </section>

      <Dialog
        open={resetOpen}
        onClose={closeReset}
        title="Reset all progress?"
        description="This permanently deletes your schedules, exam scores, XP, level and streak on this device. Consider exporting a backup first."
      >
        <div className="flex justify-end gap-2">
          <button type="button" data-autofocus onClick={closeReset} className="btn btn-ghost">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              resetProgress();
              closeReset();
              setMessage({ tone: "ok", text: "Progress reset. Fresh start!" });
              useUi.getState().announce("Progress reset.");
            }}
            className="btn btn-danger"
          >
            Reset everything
          </button>
        </div>
      </Dialog>

      <Dialog
        open={pendingImport !== null}
        onClose={() => setPendingImport(null)}
        title="Replace progress with this backup?"
        description={pendingImport ? `The backup has ${Object.keys(pendingImport.cards).length} studied cards, ${Object.keys(pendingImport.exams).length} exam records and ${pendingImport.xp} XP. Your current progress on this device will be replaced.` : undefined}
      >
        <div className="flex justify-end gap-2">
          <button type="button" data-autofocus onClick={() => setPendingImport(null)} className="btn btn-ghost">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (pendingImport) replaceProgress(pendingImport);
              setPendingImport(null);
              setMessage({ tone: "ok", text: "Backup imported." });
            }}
            className="btn btn-primary"
          >
            Import
          </button>
        </div>
      </Dialog>
    </div>
  );
}
