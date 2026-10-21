"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "./ChartTooltip";

const axis = { tick: { fill: "var(--color-fg-subtle)", fontSize: 11 }, axisLine: false, tickLine: false } as const;

function shortDay(day: string) {
  const [, m, d] = day.split("-").map(Number);
  return `${d} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]}`;
}

/** One series per chart (never dual-axis): the title names the series, so no legend is needed. */
export function TrendLine({ data, dataKey, name, format = (v) => String(v), height = 220 }: {
  data: { day: string; [key: string]: number | string }[];
  dataKey: string;
  name: string;
  format?: (v: number | string) => string;
  height?: number;
}) {
  const last = data[data.length - 1];
  return (
    <figure aria-label={`${name} over the last ${data.length} days. Latest value ${last ? format(last[dataKey]) : "none"}.`}>
      <div style={{ height }} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: -12 }} accessibilityLayer={false}>
            <CartesianGrid vertical={false} stroke="var(--color-line)" />
            <XAxis dataKey="day" tickFormatter={shortDay} minTickGap={28} {...axis} />
            <YAxis allowDecimals={false} width={44} {...axis} />
            <Tooltip
              cursor={{ stroke: "var(--color-line-strong)", strokeWidth: 1 }}
              content={({ active, payload, label }) => <ChartTooltip active={active} payload={payload as never} label={label ? shortDay(String(label)) : undefined} format={format} />}
            />
            <Line type="monotone" dataKey={dataKey} name={name} stroke="var(--color-chart-1)" strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--color-surface)" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

export function ForecastBars({ data, height = 200 }: { data: { day: string; due: number }[]; height?: number }) {
  const total = data.reduce((s, d) => s + d.due, 0);
  return (
    <figure aria-label={`Cards due over the next ${data.length} days: ${total} in total.`}>
      <div style={{ height }} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: -12 }} barCategoryGap={4} accessibilityLayer={false}>
            <CartesianGrid vertical={false} stroke="var(--color-line)" />
            <XAxis dataKey="day" tickFormatter={shortDay} minTickGap={20} {...axis} />
            <YAxis allowDecimals={false} width={44} {...axis} />
            <Tooltip
              cursor={{ fill: "var(--color-surface-3)" }}
              content={({ active, payload, label }) => <ChartTooltip active={active} payload={payload as never} label={label ? shortDay(String(label)) : undefined} format={(v) => `${v} card${v === 1 ? "" : "s"}`} />}
            />
            <Bar dataKey="due" name="Due" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
