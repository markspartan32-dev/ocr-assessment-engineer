"use client";

import { motion } from "framer-motion";
import { Eye } from "lucide-react";
import { useEffect, useRef, type ReactNode, type Ref } from "react";
import { topicTitle } from "@/lib/content";
import type { Flashcard, Unit } from "@/lib/content-types";
import type { ReviewKind } from "@/lib/srs/scheduler";
import { useUi } from "@/store/ui";
import { UnitCode } from "@/components/ui/UnitTag";

const KIND_LABEL: Record<ReviewKind, { text: string; className: string }> = {
  new: { text: "New", className: "border-accent/40 bg-accent/10 text-accent" },
  review: { text: "Due review", className: "border-ok/40 bg-ok/10 text-ok" },
  repeat: { text: "Repeat", className: "border-bad/40 bg-bad/10 text-bad" },
  practice: { text: "Practice", className: "border-line-strong bg-surface-3 text-fg-muted" },
};

function Face({ side, hidden, children, ref }: { side: "front" | "back"; hidden: boolean; children: ReactNode; ref: Ref<HTMLDivElement> }) {
  return (
    <div
      ref={ref}
      tabIndex={-1}
      data-focus-return
      aria-hidden={hidden}
      inert={hidden}
      className={`card flex min-h-72 flex-col p-6 outline-none backface-hidden [grid-area:stack] sm:min-h-80 sm:p-8 ${side === "back" ? "rotate-y-180 border-accent/30" : ""}`}
    >
      {children}
    </div>
  );
}

/**
 * A flashcard with a 3D flip. Both faces share one grid cell, so the card takes the height of
 * the taller face. The hidden face is aria-hidden and inert, so focus moves to the visible face:
 * the answer once revealed, and (with `takeFocus`) the question of each new card.
 */
export function Flashcard3D({ card, unit, kind, revealed, takeFocus, onReveal }: { card: Flashcard; unit: Unit; kind: ReviewKind; revealed: boolean; takeFocus: boolean; onReveal: () => void }) {
  const badge = KIND_LABEL[kind];
  const front = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (revealed) back.current?.focus({ preventScroll: true });
    // Never pull focus behind an open level-up dialog; it hands focus back here when dismissed.
    else if (takeFocus && useUi.getState().levelUp === null) front.current?.focus({ preventScroll: true });
  }, [revealed, takeFocus]);
  const header = (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <UnitCode code={unit.code} />
      <span className="text-fg-subtle" aria-hidden="true">/</span>
      <span className="text-fg-muted">{topicTitle(unit, card.topicArea)}</span>
      <span className={`ml-auto rounded-full border px-2 py-0.5 font-medium ${badge.className}`}>{badge.text}</span>
    </div>
  );

  return (
    <div className="perspective-distant">
      <motion.div
        className="grid transform-3d [grid-template-areas:'stack']"
        initial={false}
        animate={{ rotateY: revealed ? 180 : 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 26 }}
      >
        <Face ref={front} side="front" hidden={revealed}>
          {header}
          <p className="eyebrow mt-6">Question</p>
          <h2 className="mt-2 text-xl font-semibold leading-snug text-balance sm:text-2xl">{card.front}</h2>
          <div className="mt-auto flex items-center justify-between pt-8">
            <span className="hidden text-xs text-fg-subtle sm:inline">
              Recall the answer, then reveal it <span className="kbd ml-1">Space</span>
            </span>
            <button type="button" onClick={onReveal} className="btn btn-primary w-full sm:w-auto">
              <Eye aria-hidden="true" className="size-4" /> Show answer
            </button>
          </div>
        </Face>
        <Face ref={back} side="back" hidden={!revealed}>
          {header}
          <p className="eyebrow mt-6">Answer</p>
          <p className="mt-2 text-base leading-7 whitespace-pre-line text-fg sm:text-lg">{card.back}</p>
          <ul className="mt-auto flex flex-wrap gap-2 pt-6" aria-label="Key terms">
            {card.keyTerms.map((term) => (
              <li key={term} className="rounded-md border border-line-strong bg-surface-2 px-2 py-0.5 font-mono text-xs text-fg-muted">
                {term}
              </li>
            ))}
          </ul>
        </Face>
      </motion.div>
    </div>
  );
}
