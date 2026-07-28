import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import type { SundayMetric, CampusPulse } from "../lib/sunday-metrics";
import { getCampusPulse } from "../lib/sunday-metrics";
import { metricOptions, type KpiKey } from "../lib/mock-data";

type CampusPulseCardProps = {
  metrics: SundayMetric[];
};

export function CampusPulseCard({ metrics }: CampusPulseCardProps) {
  const [selectedMetric, setSelectedMetric] = useState<KpiKey>("attendance");
  const pulse = useMemo(() => getCampusPulse(metrics, selectedMetric, 8), [metrics, selectedMetric]);

  return (
    <section className="rounded-[30px] border border-gray-200 bg-white p-6 lg:p-7">
      <div className="border-b border-gray-200 pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Campus pulse</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">All campuses at a glance</h2>
        <p className="mt-2 text-sm text-gray-500">
          {metricOptions.find((m) => m.key === selectedMetric)?.label ?? "Attendance"} over the last {pulse[0]?.sparkline.length ?? 8} Sundays.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {metricOptions.map((option) => {
            const active = option.key === selectedMetric;
            return (
              <button
                key={option.key}
                onClick={() => setSelectedMetric(option.key)}
                className={[
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                  active
                    ? "border-[#111827] bg-[#111827] text-white"
                    : "border-gray-200 bg-white text-slate-700 hover:bg-gray-50",
                ].join(" ")}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {pulse.length === 0 ? (
        <p className="mt-5 text-sm text-gray-500">
          No {metricOptions.find((m) => m.key === selectedMetric)?.label.toLowerCase()} data recorded yet.
        </p>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
          {pulse.map((campus) => (
            <PulseTile key={campus.campus} campus={campus} />
          ))}
        </div>
      )}
    </section>
  );
}

function PulseTile({ campus }: { campus: CampusPulse }) {
  const isUp = campus.pctChange >= 0;
  const data = campus.sparkline.map((p, i) => ({ index: i, value: p.value }));

  return (
    <article className="rounded-2xl border border-gray-200 bg-[#fbfbfc] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-950 truncate">{campus.campus}</p>
          <p className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-slate-950">{campus.latest.toLocaleString()}</p>
        </div>
        <span
          className={[
            "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold whitespace-nowrap",
            isUp ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700",
          ].join(" ")}
        >
          {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {campus.pctChange > 0 ? "+" : ""}
          {campus.pctChange}%
        </span>
      </div>

      <div className="mt-3 h-12">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <Line
              type="monotone"
              dataKey="value"
              stroke={isUp ? "#ea580c" : "#dc2626"}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-2 text-xs text-gray-500">vs prior {campus.previous.toLocaleString()}</p>
    </article>
  );
}
