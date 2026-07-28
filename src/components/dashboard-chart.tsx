import { useMemo, useState, type ReactNode } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ComparisonFilters, KpiKey, Period } from "../lib/mock-data";
import { getMetricLabel, metricOptions } from "../lib/mock-data";
import {
  type ComparisonDatasetPoint,
  formatPeriodShort,
  getComparisonPeriods,
  getComparisonLineKeys,
} from "../lib/sunday-metrics";
import { ChevronDown, Download, GitCompareArrows, Plus, X } from "lucide-react";

const lineColors = ["#ea580c", "#0f172a", "#2563eb", "#eab308", "#14b8a6", "#dc2626", "#7c3aed", "#0891b2", "#84cc16", "#ec4899"];

const quarterOptions = [
  { value: 0, label: "Full Year" },
  { value: 1, label: "Q1 (Jan–Mar)" },
  { value: 2, label: "Q2 (Apr–Jun)" },
  { value: 3, label: "Q3 (Jul–Sep)" },
  { value: 4, label: "Q4 (Oct–Dec)" },
];

const monthOptions = [
  { value: 0, label: "All Months" },
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

type DashboardChartProps = {
  data: ComparisonDatasetPoint[];
  filters: ComparisonFilters;
  campusOptions: string[];
  yearOptions: string[];
  onFiltersChange: (nextFilters: ComparisonFilters) => void;
  onExportCsv: () => void;
  onExportSummary: () => void;
  onExportPdfReady: () => void;
};

export function DashboardChart({
  data,
  filters,
  campusOptions,
  yearOptions,
  onFiltersChange,
  onExportCsv,
  onExportSummary,
  onExportPdfReady,
}: DashboardChartProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const comparisonPeriods = useMemo(() => getComparisonPeriods(filters), [filters]);
  const lineKeys = useMemo(() => getComparisonLineKeys(filters), [filters]);

  const peakPoint = useMemo(() => {
    return data.reduce(
      (best, point) => {
        const entries = lineKeys.map((k) => ({ key: k, value: point.values[k] ?? 0 }));
        const peak = entries.reduce((h, e) => (e.value > h.value ? e : h), entries[0] ?? { key: "—", value: 0 });
        return peak.value > best.value ? { label: point.label, key: peak.key, value: peak.value } : best;
      },
      { label: data[0]?.label ?? "—", key: lineKeys[0] ?? "—", value: 0 },
    );
  }, [data, lineKeys]);

  const nonZeroData = data.filter((p) => p.total > 0);
  const latestPoint = nonZeroData[nonZeroData.length - 1] ?? { label: "—", values: {}, leader: "—", spread: 0, total: 0 };
  const averageSpread = Math.round(nonZeroData.reduce((s, p) => s + p.spread, 0) / Math.max(nonZeroData.length, 1));
  const canAddCampus = filters.selectedCampuses.length < campusOptions.length;
  const maxComparisonPeriods = Math.max(yearOptions.length - 1, 0);
  const canAddComparisonPeriod = comparisonPeriods.length < maxComparisonPeriods;
  const lineGroupSize = Math.max(filters.selectedCampuses.length, 1);

  const commitFilters = (nextFilters: ComparisonFilters) => {
    const normalizedComparisonPeriods = getComparisonPeriods(nextFilters);
    onFiltersChange({
      ...nextFilters,
      comparisonPeriods: normalizedComparisonPeriods,
      periodB: normalizedComparisonPeriods[0],
    });
  };

  const updatePeriodA = (update: Partial<Period>) => {
    commitFilters({ ...filters, periodA: { ...filters.periodA, ...update } });
  };

  const updateComparisonPeriod = (index: number, update: Partial<Period>) => {
    const nextComparisonPeriods = [...comparisonPeriods];
    nextComparisonPeriods[index] = { ...nextComparisonPeriods[index], ...update };
    commitFilters({ ...filters, comparisonPeriods: nextComparisonPeriods });
  };

  const addComparisonPeriod = () => {
    const usedYears = new Set([filters.periodA.year, ...comparisonPeriods.map((period) => period.year)]);
    const sortedCandidateYears = [...yearOptions].sort((left, right) => Number(right) - Number(left));
    const nextYear =
      sortedCandidateYears.find((year) => !usedYears.has(year)) ??
      sortedCandidateYears.find((year) => year !== filters.periodA.year);
    if (!nextYear) return;
    commitFilters({
      ...filters,
      comparisonPeriods: [
        ...comparisonPeriods,
        { year: nextYear, quarter: filters.periodA.quarter, month: filters.periodA.month },
      ],
    });
  };

  const removeComparisonPeriod = (index: number) => {
    commitFilters({ ...filters, comparisonPeriods: comparisonPeriods.filter((_, periodIndex) => periodIndex !== index) });
  };

  const addCampus = () => {
    const next = campusOptions.find((c) => !filters.selectedCampuses.includes(c));
    if (!next) return;
    commitFilters({ ...filters, selectedCampuses: [...filters.selectedCampuses, next] });
  };

  const updateCampus = (index: number, value: string) => {
    const next = [...filters.selectedCampuses];
    next[index] = value;
    commitFilters({ ...filters, selectedCampuses: Array.from(new Set(next)) });
  };

  const removeCampus = (index: number) => {
    commitFilters({ ...filters, selectedCampuses: filters.selectedCampuses.filter((_, i) => i !== index) });
  };

  const getMonthOptionsForQuarter = (quarter?: number) => {
    if (!quarter) return monthOptions;
    const startMonth = (quarter - 1) * 3 + 1;
    return [
      { value: 0, label: "All Months" },
      ...monthOptions.filter((m) => m.value >= startMonth && m.value <= startMonth + 2),
    ];
  };

  return (
    <section className="rounded-[30px] border border-gray-200 bg-white p-6 lg:p-7">
      <div className="flex flex-col gap-5 border-b border-gray-200 pb-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Performance</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-slate-950">Campus comparison</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
              Compare campuses across any time period — full year, quarter, or month. Layer multiple years or period cuts side by side when you want a longer trend read.
            </p>
          </div>

          <div className="relative">
            <button
              onClick={() => setMenuOpen((c) => !c)}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 text-sm font-semibold text-slate-900 transition hover:bg-gray-50"
            >
              <Download className="h-4 w-4" />
              Export
              <ChevronDown className="h-4 w-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-14 z-10 w-56 rounded-2xl border border-gray-200 bg-white p-2 shadow-none">
                <ExportOption label="CSV data export" description="Raw period-by-period comparison" onClick={() => { onExportCsv(); setMenuOpen(false); }} />
                <ExportOption label="Board brief" description="Narrative summary in text format" onClick={() => { onExportSummary(); setMenuOpen(false); }} />
                <ExportOption label="PDF-ready report" description="Full analysis with growth insights" onClick={() => { onExportPdfReady(); setMenuOpen(false); }} />
              </div>
            )}
          </div>
        </div>

        {/* Period selectors */}
        <div className="grid gap-4 xl:grid-cols-[repeat(2,minmax(0,1fr))]">
          <PeriodCard
            label="Period A"
            period={filters.periodA}
            yearOptions={yearOptions}
            monthOptionsFiltered={getMonthOptionsForQuarter(filters.periodA.quarter)}
            onUpdate={updatePeriodA}
          />
          {comparisonPeriods.map((period, index) => (
            <PeriodCard
              key={`${period.year}-${period.quarter ?? 0}-${period.month ?? 0}-${index}`}
              label={`Period ${String.fromCharCode(66 + index)} (comparison)`}
              period={period}
              yearOptions={yearOptions}
              monthOptionsFiltered={getMonthOptionsForQuarter(period.quarter)}
              onUpdate={(update) => updateComparisonPeriod(index, update)}
              onRemove={() => removeComparisonPeriod(index)}
            />
          ))}
          {canAddComparisonPeriod && (
            <button
              onClick={addComparisonPeriod}
              className="flex items-center justify-center gap-3 rounded-[24px] border-2 border-dashed border-gray-200 bg-[#fbfbfc] p-4 text-sm font-semibold text-gray-500 transition hover:border-gray-300 hover:text-slate-700"
            >
              <Plus className="h-4 w-4" />
              Add comparison year
            </button>
          )}
        </div>

        {/* Campus + metric selectors */}
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(220px,0.7fr)]">
          <div className="rounded-[24px] border border-gray-200 bg-[#fbfbfc] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Selected campuses</p>
                <p className="mt-2 text-base font-semibold text-slate-950">
                  {formatCampusSummary(filters.selectedCampuses)}
                </p>
              </div>
              <button
                onClick={addCampus}
                disabled={!canAddCampus}
                className={[
                  "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition",
                  canAddCampus ? "border-gray-200 bg-white text-slate-900 hover:bg-gray-50" : "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400",
                ].join(" ")}
              >
                <Plus className="h-4 w-4" />
                Add campus
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {filters.selectedCampuses.map((campus, index) => (
                <div key={`${campus}-${index}`} className="rounded-[20px] border border-gray-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Campus {index + 1}</p>
                    {filters.selectedCampuses.length > 1 && (
                      <button
                        onClick={() => removeCampus(index)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-slate-500 transition hover:bg-gray-50 hover:text-slate-900"
                        aria-label={`Remove ${campus}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="mt-3">
                    <FilterSelect label="Campus" value={campus} onChange={(v) => updateCampus(index, v)}>
                      {campusOptions.map((opt) => (
                        <option key={opt} value={opt} disabled={opt !== campus && filters.selectedCampuses.includes(opt)}>
                          {opt}
                        </option>
                      ))}
                    </FilterSelect>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-gray-200 bg-[#fbfbfc] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Metric</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {metricOptions.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => commitFilters({ ...filters, metric: opt.key })}
                  className={[
                    "rounded-full border px-4 py-2 text-sm font-medium transition",
                    opt.key === filters.metric
                      ? "border-[#111827] bg-[#111827] text-white"
                      : "border-gray-200 bg-white text-slate-700 hover:bg-gray-50",
                  ].join(" ")}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <StatPill label="Latest leader" value={`${latestPoint.leader} in ${latestPoint.label}`} />
        <StatPill label="Peak moment" value={`${peakPoint.key} ${peakPoint.value.toLocaleString()} in ${peakPoint.label}`} />
        <StatPill label="Average spread" value={`${averageSpread.toLocaleString()} ${getMetricLabel(filters.metric).toLowerCase()}`} />
      </div>

      {/* Chart */}
      <div className="mt-6 h-[380px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#6b7280", fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: "#6b7280", fontSize: 12 }} />
            <Tooltip
              cursor={{ stroke: "#d1d5db", strokeDasharray: "4 4" }}
              contentStyle={{ borderRadius: "18px", border: "1px solid #e5e7eb", boxShadow: "none", backgroundColor: "#ffffff" }}
            />
            <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: 16 }} />
            {lineKeys.map((key, index) => (
              <Line
                key={key}
                type="monotone"
                dataKey={(point: ComparisonDatasetPoint) => point.values[key] ?? 0}
                stroke={lineColors[index % lineColors.length]}
                strokeWidth={Math.floor(index / lineGroupSize) === 0 ? 2.8 : 2.4}
                strokeDasharray={getLineStrokeDasharray(index, lineGroupSize)}
                dot={false}
                activeDot={{ r: 4 }}
                name={key}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function PeriodCard({
  label,
  period,
  yearOptions,
  monthOptionsFiltered,
  onUpdate,
  onRemove,
}: {
  label: string;
  period: Period;
  yearOptions: string[];
  monthOptionsFiltered: typeof monthOptions;
  onUpdate: (update: Partial<Period>) => void;
  onRemove?: () => void;
}) {
  return (
    <div className="rounded-[24px] border border-gray-200 bg-[#fbfbfc] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">{label}</p>
        <p className="text-sm font-semibold text-slate-950">{formatPeriodShort(period)}</p>
        {onRemove && (
          <button
            onClick={onRemove}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-slate-500 transition hover:bg-gray-50 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <FilterSelect label="Year" value={period.year} onChange={(v) => onUpdate({ year: v })}>
          {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
        </FilterSelect>
        <FilterSelect
          label="Quarter"
          value={String(period.quarter ?? 0)}
          onChange={(v) => {
            const q = Number(v) || undefined;
            onUpdate({ quarter: q, month: q ? period.month : undefined });
          }}
        >
          {quarterOptions.map((q) => <option key={q.value} value={q.value}>{q.label}</option>)}
        </FilterSelect>
        <FilterSelect
          label="Month"
          value={String(period.month ?? 0)}
          onChange={(v) => {
            const m = Number(v) || undefined;
            if (m && !period.quarter) {
              onUpdate({ month: m, quarter: Math.ceil(m / 3) });
            } else {
              onUpdate({ month: m });
            }
          }}
        >
          {monthOptionsFiltered.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </FilterSelect>
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-2xl border border-gray-200 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-900 outline-none transition hover:border-gray-300 focus:border-slate-900"
      >
        {children}
      </select>
    </label>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-gray-200 bg-[#fbfbfc] px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">{label}</p>
      <p className="mt-2 text-base font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function ExportOption({ label, description, onClick }: { label: string; description: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full flex-col rounded-xl px-3 py-2 text-left transition hover:bg-gray-50">
      <span className="text-sm font-semibold text-slate-950">{label}</span>
      <span className="mt-1 text-xs text-gray-500">{description}</span>
    </button>
  );
}

function formatCampusSummary(campuses: string[]) {
  if (campuses.length === 0) return "No campuses selected";
  if (campuses.length <= 3) return campuses.join(" / ");
  return `${campuses.slice(0, 3).join(" / ")} +${campuses.length - 3} more`;
}

function getLineStrokeDasharray(index: number, groupSize: number) {
  const periodIndex = Math.floor(index / Math.max(groupSize, 1));
  if (periodIndex === 0) return undefined;
  const dashPatterns = ["6 3", "2 4", "10 4", "4 4"];
  return dashPatterns[(periodIndex - 1) % dashPatterns.length];
}
