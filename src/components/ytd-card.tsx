import { ArrowDownRight, ArrowUpRight, CalendarRange } from "lucide-react";
import type { YtdSummary } from "../lib/sunday-metrics";

type YtdCardProps = {
  summary: YtdSummary[];
};

export function YtdCard({ summary }: YtdCardProps) {
  if (summary.length === 0) return null;

  const weeks = summary[0]?.weeksElapsed ?? 0;
  const hasMixedCoverage = new Set(summary.map((row) => row.weeksElapsed)).size > 1;

  return (
    <section className="rounded-[26px] border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Year to date</p>
          <h2 className="mt-1.5 text-xl font-semibold tracking-[-0.03em] text-slate-950">YTD vs same period last year</h2>
          <p className="mt-1 text-xs text-gray-500">
            {hasMixedCoverage
              ? "Each metric is compared through its latest available Sunday in the current year."
              : `${weeks} Sunday${weeks === 1 ? "" : "s"} of data this year compared against the same window in the prior year.`}
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#fbfbfc] text-slate-700">
          <CalendarRange className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summary.map((row) => (
          <YtdTile key={row.key} row={row} />
        ))}
      </div>
    </section>
  );
}

function YtdTile({ row }: { row: YtdSummary }) {
  const isUp = row.pctChange >= 0;
  return (
    <div className="rounded-2xl border border-gray-200 bg-[#fbfbfc] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">{row.label}</p>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <p className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">{row.ytdValue.toLocaleString()}</p>
        <span
          className={[
            "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold",
            isUp ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700",
          ].join(" ")}
        >
          {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {row.pctChange > 0 ? "+" : ""}{row.pctChange}%
        </span>
      </div>
      <p className="mt-1 text-xs text-gray-500">vs {row.priorYtdValue.toLocaleString()} prior YTD</p>
    </div>
  );
}
