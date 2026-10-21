export function ProgressBar({ value, label, tone = "accent", className = "" }: { value: number; label: string; tone?: "accent" | "xp" | "ok"; className?: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const fill = tone === "xp" ? "bg-xp" : tone === "ok" ? "bg-ok" : "bg-accent";
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className={`h-2 overflow-hidden rounded-full bg-surface-3 ${className}`}>
      <div className={`h-full rounded-full ${fill} transition-[width] duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}
