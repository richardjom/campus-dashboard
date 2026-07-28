import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { metricOptions, type KpiKey } from "../lib/mock-data";
import { getDistribution, type DistributionPeriodMode, type SundayMetric } from "../lib/sunday-metrics";

const palette = [
  "#ea580c", "#0f172a", "#2563eb", "#eab308",
  "#14b8a6", "#dc2626", "#7c3aed", "#0891b2",
  "#84cc16", "#ec4899",
];

const periodModes: Array<{ value: DistributionPeriodMode; label: string; description: string }> = [
  { value: "lastN", label: "Last 4 weeks", description: "vs prior 4 weeks" },
  { value: "ytd", label: "Year to date", description: "vs same period last year" },
  { value: "year", label: "Full year", description: "vs prior year" },
];

type DistributionCardProps = {
  metrics: SundayMetric[];
};

export function DistributionCard({ metrics }: DistributionCardProps) {
  const [metric, setMetric] = useState<KpiKey>("attendance");
  const [mode, setMode] = useState<DistributionPeriodMode>("lastN");
  const distribution = useMemo(() => getDistribution(metrics, metric, mode, 4), [metrics, metric, mode]);

  const total = distribution.reduce((s, r) => s + r.current, 0);
  const metricLabel = metricOptions.find((m) => m.key === metric)?.label ?? "Attendance";
  const activePeriod = periodModes.find((p) => p.value === mode);

  const pieData = distribution.map((row) => ({ name: row.campus, value: row.current }));

  return (
    <section className="rounded-[30px] border border-gray-200 bg-white p-6 lg:p-7">
      <div className="border-b border-gray-200 pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Distribution</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">{metricLabel} mix</h2>
        <p className="mt-2 text-sm text-gray-500">
          {activePeriod?.label} · {activePeriod?.description} · Total {total.toLocaleString()}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {periodModes.map((p) => (
            <button
              key={p.value}
              onClick={() => setMode(p.value)}
              className={[
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                mode === p.value
                  ? "border-[#111827] bg-[#111827] text-white"
                  : "border-gray-200 bg-white text-slate-700 hover:bg-gray-50",
              ].join(" ")}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          {metricOptions.map((option) => {
            const active = option.key === metric;
            return (
              <button
                key={option.key}
                onClick={() => setMetric(option.key)}
                className={[
                  "rounded-full border px-3 py-1 text-xs font-medium transition",
                  active
                    ? "border-slate-700 bg-slate-100 text-slate-900"
                    : "border-gray-200 bg-white text-slate-500 hover:bg-gray-50",
                ].join(" ")}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {distribution.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">
          No {metricLabel.toLowerCase()} data recorded for the selected period.
        </p>
      ) : (
        <>
          <div className="mt-6 h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  formatter={(value: number) => value.toLocaleString()}
                  contentStyle={{ borderRadius: "14px", border: "1px solid #e5e7eb", boxShadow: "none", backgroundColor: "#ffffff" }}
                />
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={88} paddingAngle={2} stroke="none">
                  {pieData.map((entry, i) => (
                    <Cell key={entry.name} fill={palette[i % palette.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 space-y-2">
            {distribution.map((row, i) => (
              <DistributionRow key={row.campus} row={row} color={palette[i % palette.length]} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function DistributionRow({ row, color }: { row: ReturnType<typeof getDistribution>[number]; color: string }) {
  const sharePct = (row.share * 100).toFixed(1);
  const shareDirection = row.shareChangePp > 0 ? "up" : row.shareChangePp < 0 ? "down" : "flat";
  const rankImproved = row.rankChange < 0;
  const rankWorsened = row.rankChange > 0;

  return (
    <div className="rounded-2xl border border-gray-200 bg-[#fbfbfc] px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-sm font-semibold text-slate-950 truncate">{row.campus}</span>
          <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold text-gray-500 border border-gray-200">
            #{row.rank}
          </span>
          {rankImproved && (
            <span className="inline-flex items-center text-[10px] font-semibold text-emerald-700">
              <ArrowUp className="h-3 w-3" />{Math.abs(row.rankChange)}
            </span>
          )}
          {rankWorsened && (
            <span className="inline-flex items-center text-[10px] font-semibold text-rose-600">
              <ArrowDown className="h-3 w-3" />{row.rankChange}
            </span>
          )}
        </div>
        <div className="text-right whitespace-nowrap">
          <p className="text-sm font-semibold text-slate-950">{row.current.toLocaleString()}</p>
          <p className="text-[11px] text-gray-500">{sharePct}% of total</p>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full"
            style={{ width: `${row.share * 100}%`, backgroundColor: color }}
          />
        </div>
        <span
          className={[
            "inline-flex items-center gap-1 text-[11px] font-semibold whitespace-nowrap",
            shareDirection === "up" ? "text-emerald-700" : shareDirection === "down" ? "text-rose-600" : "text-gray-500",
          ].join(" ")}
          title="Change in share of total since prior period"
        >
          {shareDirection === "up" && <ArrowUp className="h-3 w-3" />}
          {shareDirection === "down" && <ArrowDown className="h-3 w-3" />}
          {shareDirection === "flat" && <Minus className="h-3 w-3" />}
          {row.shareChangePp > 0 ? "+" : ""}{row.shareChangePp}pp share
        </span>
      </div>
    </div>
  );
}
