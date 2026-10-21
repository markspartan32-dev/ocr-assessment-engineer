"use client";

/** Shared tooltip body: values in text ink, a colour swatch carries series identity. */
export function ChartTooltip({ active, payload, label, format = (v) => String(v) }: {
  active?: boolean;
  payload?: ReadonlyArray<{ name?: string | number; value?: number | string; color?: string; dataKey?: string | number }>;
  label?: string | number;
  format?: (value: number | string, name?: string | number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line-strong bg-surface-2/95 px-3 py-2 text-xs shadow-xl shadow-black/40 backdrop-blur">
      {label !== undefined && <p className="mb-1 font-semibold text-fg">{label}</p>}
      <ul className="space-y-0.5">
        {payload.map((item) => (
          <li key={String(item.dataKey ?? item.name)} className="flex items-center gap-2 text-fg-muted">
            <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
            <span>{item.name}</span>
            <span className="ml-auto pl-3 font-mono font-semibold text-fg">{item.value !== undefined ? format(item.value, item.name) : "–"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
