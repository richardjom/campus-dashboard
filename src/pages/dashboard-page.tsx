import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { KpiCard } from "../components/kpi-card";
import { DashboardChart } from "../components/dashboard-chart";
import { InsightsPanel } from "../components/insights-panel";
import { CampusPulseCard } from "../components/campus-pulse";
import { DistributionCard } from "../components/distribution-card";
import { YtdCard } from "../components/ytd-card";
import {
  type ComparisonFilters,
} from "../lib/mock-data";
import { getBigEventOverview } from "../lib/big-events";
import {
  buildComparisonBrief,
  buildComparisonCsv,
  buildComparisonHtml,
  deriveCampusSnapshotsFromMetrics,
  deriveKpiCardsFromMetrics,
  deriveYtdSummary,
  formatPeriodShort,
  getAvailableCampuses,
  getAvailableYears,
  getComparisonPeriods,
  getComparisonDatasetFromMetrics,
  getDashboardInsights,
  getEventNotes,
} from "../lib/sunday-metrics";
import { CalendarDays, FileText, TrendingUp, Upload } from "lucide-react";
import { useBigEvents } from "../hooks/use-big-events";
import { useSundayMetrics } from "../hooks/use-sunday-metrics";

export function DashboardPage() {
  const { metrics, source } = useSundayMetrics();
  const { records: bigEventRecords } = useBigEvents();
  const availableCampuses = useMemo(() => getAvailableCampuses(metrics), [metrics]);
  const availableYears = useMemo(() => getAvailableYears(metrics), [metrics]);
  const kpiCards = useMemo(() => deriveKpiCardsFromMetrics(metrics), [metrics]);
  const ytdSummary = useMemo(() => deriveYtdSummary(metrics), [metrics]);
  const campusSnapshots = useMemo(() => deriveCampusSnapshotsFromMetrics(metrics), [metrics]);
  const bigEventOverview = useMemo(() => getBigEventOverview(bigEventRecords, metrics), [bigEventRecords, metrics]);
  const initialComparisonPeriods = availableYears.length > 1 ? [{ year: availableYears.at(-2) ?? availableYears[0] ?? "2025" }] : [];
  const [filters, setFilters] = useState<ComparisonFilters>({
    selectedCampuses: availableCampuses.slice(0, Math.min(2, availableCampuses.length)),
    metric: "attendance",
    periodA: { year: availableYears.at(-1) ?? "2026" },
    comparisonPeriods: initialComparisonPeriods,
    periodB: initialComparisonPeriods[0],
  });

  useEffect(() => {
    const fallbackSelection = availableCampuses.slice(0, Math.min(2, availableCampuses.length));

    setFilters((current) => {
      const sanitizedComparisonPeriods = getComparisonPeriods({
        ...current,
        comparisonPeriods: (current.comparisonPeriods?.length ? current.comparisonPeriods : current.periodB ? [current.periodB] : []).filter((period) =>
          availableYears.includes(period.year),
        ),
      });

      return {
        ...current,
        selectedCampuses:
          current.selectedCampuses.filter((campus) => availableCampuses.includes(campus)).length > 0
            ? Array.from(new Set(current.selectedCampuses.filter((campus) => availableCampuses.includes(campus))))
            : fallbackSelection,
        periodA: {
          ...current.periodA,
          year: availableYears.includes(current.periodA.year) ? current.periodA.year : availableYears.at(-1) ?? current.periodA.year,
        },
        comparisonPeriods: sanitizedComparisonPeriods,
        periodB: sanitizedComparisonPeriods[0],
      };
    });
  }, [availableCampuses, availableYears]);

  const comparisonData = useMemo(() => getComparisonDatasetFromMetrics(metrics, filters), [filters, metrics]);
  const insights = useMemo(() => getDashboardInsights(metrics, filters), [metrics, filters]);
  const events = useMemo(() => getEventNotes(metrics), [metrics]);
  const comparisonSlug = filters.selectedCampuses.map(slugify).join("-vs-") || "campus-comparison";
  const comparisonPeriods = useMemo(() => getComparisonPeriods(filters), [filters]);
  const periodSlug = [formatPeriodShort(filters.periodA), ...comparisonPeriods.map((period) => formatPeriodShort(period))].join("-vs-");

  const exportComparisonCsv = () => {
    downloadFile(
      `${comparisonSlug}-${filters.metric}-${periodSlug}.csv`,
      buildComparisonCsv(comparisonData, filters),
      "text/csv;charset=utf-8",
    );
  };

  const exportComparisonSummary = () => {
    downloadFile(
      `${comparisonSlug}-${filters.metric}-${periodSlug}-brief.txt`,
      buildComparisonBrief(comparisonData, filters, metrics),
      "text/plain;charset=utf-8",
    );
  };

  const exportComparisonPdfReady = () => {
    downloadFile(
      `${comparisonSlug}-${filters.metric}-${periodSlug}-report.html`,
      buildComparisonHtml(comparisonData, filters, metrics),
      "text/html;charset=utf-8",
    );
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      <section className="rounded-[30px] border border-gray-200 bg-white p-6 lg:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Performance workspace</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.06em] text-slate-950 sm:text-5xl">
              Church analytics dashboard
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-gray-600">
              Review campus performance, compare periods side by side, and generate export-ready reports with full analysis.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <div
              className={[
                "inline-flex h-12 items-center rounded-2xl border px-4 text-sm font-semibold",
                source !== "mock"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-gray-200 bg-white text-slate-700",
              ].join(" ")}
            >
              {source === "imported"
                ? "Using imported data"
                : source === "bundle"
                  ? "Using bundled campus files"
                  : "Using mock data"}
            </div>
            <Link
              to="/records"
              className="inline-flex h-12 items-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 text-sm font-semibold text-slate-900 transition hover:bg-gray-50"
            >
              <Upload className="h-4 w-4" />
              Import test data
            </Link>
            <Link
              to="/insights"
              className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[#2563eb] px-5 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]"
            >
              <FileText className="h-4 w-4" />
              Open reports
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card) => (
          <KpiCard key={card.key} card={card} />
        ))}
      </section>

      <YtdCard summary={ytdSummary} />

      {bigEventOverview && <BigEventOutlookCard overview={bigEventOverview} />}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(340px,0.95fr)]">
        <div className="space-y-6">
          <DashboardChart
            data={comparisonData}
            filters={filters}
            campusOptions={availableCampuses}
            yearOptions={availableYears}
            onFiltersChange={setFilters}
            onExportCsv={exportComparisonCsv}
            onExportSummary={exportComparisonSummary}
            onExportPdfReady={exportComparisonPdfReady}
          />
          <CampusPulseCard metrics={metrics} />
        </div>

        <InsightsPanel insights={insights} events={events} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <CampusSnapshotCard snapshots={campusSnapshots} />
        <DistributionCard metrics={metrics} />
      </section>
    </div>
  );
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function BigEventOutlookCard({ overview }: { overview: NonNullable<ReturnType<typeof getBigEventOverview>> }) {
  return (
    <section className="rounded-[30px] border border-gray-200 bg-white p-6 lg:p-7">
      <div className="flex flex-col gap-5 border-b border-gray-200 pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Big 5 outlook</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">Event lift and future pacing</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">{overview.summary}</p>
        </div>

        <Link
          to="/insights"
          className="inline-flex h-11 items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 text-sm font-semibold text-slate-900 transition hover:bg-gray-50"
        >
          <CalendarDays className="h-4 w-4" />
          Open reports
        </Link>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Completed or live in {overview.currentYear}</p>
          {overview.completed.slice(0, 3).map((event) => (
            <div key={event.event} className="rounded-2xl border border-gray-200 bg-[#fbfbfc] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">{event.event}</p>
                  <p className="mt-1 text-xs text-gray-500">{event.status}</p>
                </div>
                <span
                  className={[
                    "inline-flex rounded-full px-3 py-1 text-[11px] font-semibold",
                    event.yoyChange !== null && event.yoyChange >= 0
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700",
                  ].join(" ")}
                >
                  {formatSignedPercent(event.yoyChange, event.samePhaseDelta === null ? "Watch" : formatSignedPercent(event.samePhaseDelta, "Watch"))}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
                {event.currentTotal !== null && <span>{overview.currentYear}: {event.currentTotal.toLocaleString()}</span>}
                {event.priorTotal !== null && <span>Prior year: {event.priorTotal.toLocaleString()}</span>}
                {event.liftFromPreEvent !== null && <span>Lift: {event.liftFromPreEvent > 0 ? "+" : ""}{event.liftFromPreEvent}%</span>}
                {event.retentionAfterEvent !== null && <span>Retention: {event.retentionAfterEvent}%</span>}
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-700">{event.explanation}</p>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Forward view</p>
          {overview.upcoming.length > 0 ? (
            overview.upcoming.slice(0, 3).map((forecast) => (
              <div key={forecast.event} className="rounded-2xl border border-gray-200 bg-[#fbfbfc] p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-950">{forecast.event}</p>
                  <span className="inline-flex rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-600">
                    {forecast.trend}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2 text-slate-950">
                  <TrendingUp className="h-4 w-4 text-sky-600" />
                  <p className="text-sm font-semibold">
                    Base {forecast.forecastBase.toLocaleString()} · Range {forecast.forecastLow.toLocaleString()}-{forecast.forecastHigh.toLocaleString()}
                  </p>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-700">{forecast.rationale}</p>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-[#fbfbfc] p-4 text-sm leading-6 text-gray-500">
              No upcoming Big 5 events are waiting on a forecast right now.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function CampusSnapshotCard({ snapshots }: { snapshots: ReturnType<typeof deriveCampusSnapshotsFromMetrics> }) {
  return (
    <section className="rounded-[30px] border border-gray-200 bg-white p-6 lg:p-7">
      <div className="flex items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Campus ledger</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">Latest location snapshot</h2>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-4 pr-6 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Campus</th>
              <th className="py-4 pr-6 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Attendance</th>
              <th className="py-4 pr-6 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Volunteers</th>
              <th className="py-4 pr-6 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Guests</th>
              <th className="py-4 pr-0 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Status</th>
            </tr>
          </thead>
          <tbody>
            {snapshots.map((campus) => (
              <tr key={campus.campus} className="border-b border-gray-200 last:border-b-0">
                <td className="py-4 pr-6 text-sm font-semibold text-slate-950">{campus.campus}</td>
                <td className="py-4 pr-6 text-sm text-slate-700">{campus.attendance.toLocaleString()}</td>
                <td className="py-4 pr-6 text-sm text-slate-700">{campus.volunteers.toLocaleString()}</td>
                <td className="py-4 pr-6 text-sm text-slate-700">{campus.firstTimeGuests.toLocaleString()}</td>
                <td className="py-4 pr-0">
                  <span
                    className={[
                      "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
                      campus.status === "Growing"
                        ? "bg-emerald-100 text-emerald-700"
                        : campus.status === "Stable"
                          ? "bg-sky-100 text-sky-700"
                          : "bg-amber-100 text-amber-700",
                    ].join(" ")}
                  >
                    {campus.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function formatSignedPercent(value: number | null, fallback = "N/A") {
  if (value === null || Number.isNaN(value)) return fallback;
  return `${value > 0 ? "+" : ""}${value}%`;
}
