"use client";

import { Legend, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import { UNITS, UNIT_SHORT_NAMES } from "@/lib/content";
import type { UnitCode } from "@/lib/content-types";
import { percent, type UnitMastery } from "@/lib/mastery";
import { ChartTooltip } from "./ChartTooltip";

const SERIES = [
  { key: "recall", name: "Recall (SM-2)", color: "var(--color-chart-1)" },
  { key: "exam", name: "Exam score", color: "var(--color-chart-2)" },
] as const;

/**
 * Mastery across all seven units. Two series (validated palette slots 1 and 2), with a legend
 * and per-axis tooltips; the analytics page carries the same numbers as a table.
 */
export function MasteryRadar({ masteries, height = 340, compact = false }: { masteries: Record<UnitCode, UnitMastery>; height?: number; compact?: boolean }) {
  const data = UNITS.map((u) => ({
    axis: compact ? u.code : `${u.code} ${UNIT_SHORT_NAMES[u.code]}`,
    label: `${u.code}: ${u.title}`,
    recall: percent(masteries[u.code].recall),
    exam: percent(masteries[u.code].exam),
  }));
  const summary = data.map((d) => `${d.label}: recall ${d.recall}%, exam ${d.exam}%`).join("; ");

  return (
    <figure className="w-full" aria-label={`Mastery radar chart. ${summary}`}>
      <div style={{ height }} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius={compact ? "68%" : "72%"} margin={{ top: 8, right: 24, bottom: 8, left: 24 }} accessibilityLayer={false}>
            <PolarGrid stroke="var(--color-line-strong)" />
            <PolarAngleAxis dataKey="axis" tick={{ fill: "var(--color-fg-muted)", fontSize: compact ? 11 : 12 }} />
            <PolarRadiusAxis domain={[0, 100]} tickCount={5} angle={64} tick={{ fill: "var(--color-fg-subtle)", fontSize: 10 }} axisLine={false} tickFormatter={(v) => (v ? `${v}%` : "")} />
            {SERIES.map((s) => (
              <Radar key={s.key} name={s.name} dataKey={s.key} stroke={s.color} strokeWidth={2} fill={s.color} fillOpacity={0.14} dot={{ r: 3, strokeWidth: 0, fill: s.color }} />
            ))}
            <Tooltip
              content={({ active, payload }) => (
                <ChartTooltip active={active} payload={payload as never} label={(payload?.[0]?.payload as { label?: string } | undefined)?.label} format={(v) => `${v}%`} />
              )}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12, paddingTop: 4 }}
              itemSorter={(item) => SERIES.findIndex((s) => s.key === item.dataKey)}
              formatter={(value) => <span style={{ color: "var(--color-fg-muted)" }}>{value}</span>}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
