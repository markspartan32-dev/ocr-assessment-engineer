import type { Assessment } from "@/lib/content-types";

export function UnitCode({ code, className = "" }: { code: string; className?: string }) {
  return <span className={`font-mono text-xs font-semibold tracking-wider text-accent ${className}`}>{code}</span>;
}

export function AssessmentBadge({ assessment }: { assessment: Assessment }) {
  return assessment === "exam" ? (
    <span className="rounded-full border border-violet/40 bg-violet/10 px-2 py-0.5 text-[0.7rem] font-medium text-violet">Exam</span>
  ) : (
    <span className="rounded-full border border-line-strong bg-surface-2 px-2 py-0.5 text-[0.7rem] font-medium text-fg-muted">NEA</span>
  );
}
