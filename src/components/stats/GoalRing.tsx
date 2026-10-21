/** Circular progress for today's review goal. */
export function GoalRing({ done, goal, size = 44 }: { done: number; goal: number; size?: number }) {
  const ratio = goal > 0 ? Math.min(1, done / goal) : 0;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-surface-3)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={ratio >= 1 ? "var(--color-ok)" : "var(--color-accent)"}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - ratio)}
        className="transition-[stroke-dashoffset] duration-700"
      />
    </svg>
  );
}
