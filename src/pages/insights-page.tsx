import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Download,
  FileText,
  LineChart,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import type { ComparisonFilters, KpiKey, Period } from "../lib/mock-data";
import { getBigEventOverview } from "../lib/big-events";
import {
  buildComparisonBrief,
  buildComparisonHtml,
  churchGrowthBenchmarks,
  formatPeriodLong,
  getAvailableCampuses,
  getAvailableYears,
  getComparisonDatasetFromMetrics,
  getDashboardInsights,
  getEventNotes,
  type SundayMetric,
} from "../lib/sunday-metrics";
import { useBigEvents } from "../hooks/use-big-events";
import { useSundayMetrics } from "../hooks/use-sunday-metrics";

export function InsightsPage() {
  const { metrics, source } = useSundayMetrics();
  const { records: bigEventRecords } = useBigEvents();
  const availableCampuses = useMemo(() => getAvailableCampuses(metrics), [metrics]);
  const availableYears = useMemo(() => getAvailableYears(metrics), [metrics]);
  const latestYear = availableYears.at(-1) ?? new Date().getFullYear().toString();
  const [selectedScope, setSelectedScope] = useState("all");
  const [selectedYear, setSelectedYear] = useState(latestYear);

  useEffect(() => {
    setSelectedYear((current) => (availableYears.includes(current) ? current : latestYear));
  }, [availableYears, latestYear]);

  useEffect(() => {
    setSelectedScope((current) => (current === "all" || availableCampuses.includes(current) ? current : "all"));
  }, [availableCampuses]);

  const priorYear = useMemo(() => {
    const currentYear = Number(selectedYear);
    if (Number.isNaN(currentYear)) return undefined;
    return availableYears.filter((year) => Number(year) < currentYear).at(-1);
  }, [availableYears, selectedYear]);

  const selectedCampuses = useMemo(() => {
    if (selectedScope === "all") {
      return availableCampuses;
    }

    return availableCampuses.includes(selectedScope) ? [selectedScope] : availableCampuses;
  }, [availableCampuses, selectedScope]);

  const filters = useMemo<ComparisonFilters>(
    () => ({
      selectedCampuses,
      metric: "attendance",
      periodA: { year: selectedYear },
      periodB: priorYear ? { year: priorYear } : undefined,
    }),
    [priorYear, selectedCampuses, selectedYear],
  );

  const scopedMetrics = useMemo(
    () =>
      selectedCampuses.length > 0 ? metrics.filter((metric) => selectedCampuses.includes(metric.campus)) : metrics,
    [metrics, selectedCampuses],
  );
  const comparisonData = useMemo(() => getComparisonDatasetFromMetrics(metrics, filters), [filters, metrics]);
  const insights = useMemo(() => getDashboardInsights(metrics, filters), [filters, metrics]);
  const eventNotes = useMemo(() => getEventNotes(scopedMetrics).slice(-4).reverse(), [scopedMetrics]);
  const scopeLabel = selectedScope === "all" ? "Network portfolio" : selectedScope;
  const comparisonLabel = priorYear
    ? `${formatPeriodLong(filters.periodA)} vs ${formatPeriodLong(filters.periodB!)} aligned to the current data cutoff`
    : `${formatPeriodLong(filters.periodA)} with the latest comparable window available`;
  const sourceLabel =
    source === "imported" ? "Imported dataset active" : source === "bundle" ? "Bundled campus dataset" : "Mock dataset active";
  const reportDateLabel = formatCalendarDate(new Date());
  const bigEventOverview = useMemo(() => getBigEventOverview(bigEventRecords, metrics), [bigEventRecords, metrics]);
  const chairSummary = useMemo(() => buildChairSummary(insights, scopeLabel), [insights, scopeLabel]);
  const meetingTalkingPoints = useMemo(() => buildMeetingTalkingPoints(insights, scopeLabel), [insights, scopeLabel]);
  const riskFlags = useMemo(() => buildRiskFlags(insights, scopeLabel), [insights, scopeLabel]);
  const sundayDecisions = useMemo(() => buildSundayDecisions(insights, scopeLabel), [insights, scopeLabel]);
  const deepReport = useMemo(
    () => buildDeepReport(metrics, filters, insights, scopeLabel),
    [filters, insights, metrics, scopeLabel],
  );

  const exportDailyBrief = () => {
    downloadFile(
      `${slugify(scopeLabel)}-${selectedYear}-daily-report.txt`,
      buildComparisonBrief(comparisonData, filters, metrics),
      "text/plain;charset=utf-8",
    );
  };

  const exportMeetingPacket = () => {
    downloadFile(
      `${slugify(scopeLabel)}-${selectedYear}-daily-report.html`,
      buildComparisonHtml(comparisonData, filters, metrics),
      "text/html;charset=utf-8",
    );
  };

  if (metrics.length === 0) {
    return (
      <div className="rounded-[30px] border border-gray-200 bg-white p-6 text-sm text-gray-500">
        No data is available yet. Import weekly metrics to generate executive reports.
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <section className="rounded-[30px] border border-gray-200 bg-white p-6 lg:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Daily report center</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.06em] text-slate-950 sm:text-5xl">Reports</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-gray-600">
              Daily executive reporting generated from the current analytics dataset, built for senior staff reviews,
              board prep, and decision-making meetings.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <MetaPill icon={<CalendarDays className="h-3.5 w-3.5" />} label={`Generated ${reportDateLabel}`} />
              <MetaPill
                icon={<LineChart className="h-3.5 w-3.5" />}
                label={insights.latestDate ? `Data through ${formatDateLabel(insights.latestDate)}` : "Awaiting data"}
              />
              <MetaPill icon={<Users className="h-3.5 w-3.5" />} label={scopeLabel} />
              <MetaPill icon={<ShieldCheck className="h-3.5 w-3.5" />} label={sourceLabel} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex min-w-[220px] flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Scope</span>
              <select
                value={selectedScope}
                onChange={(event) => setSelectedScope(event.target.value)}
                className="h-12 rounded-2xl border border-gray-200 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-[#2563eb]"
              >
                <option value="all">Network portfolio</option>
                {availableCampuses.map((campus) => (
                  <option key={campus} value={campus}>
                    {campus}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex min-w-[180px] flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Report year</span>
              <select
                value={selectedYear}
                onChange={(event) => setSelectedYear(event.target.value)}
                className="h-12 rounded-2xl border border-gray-200 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-[#2563eb]"
              >
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={exportDailyBrief}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 text-sm font-semibold text-slate-900 transition hover:bg-gray-50"
            >
              <Download className="h-4 w-4" />
              Export daily brief
            </button>

            <button
              type="button"
              onClick={exportMeetingPacket}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#2563eb] px-5 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]"
            >
              <FileText className="h-4 w-4" />
              Export meeting packet
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.28fr)_minmax(320px,0.88fr)]">
        <section className="rounded-[30px] border border-gray-200 bg-white p-6 lg:p-7">
          <div className="flex items-start justify-between gap-4 border-b border-gray-200 pb-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Leadership opening read</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
                {insights.executiveBrief?.headline ?? "Daily leadership report"}
              </h2>
              <p className="mt-2 text-xs text-gray-500">{comparisonLabel}</p>
            </div>
            <span
              className={[
                "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
                insights.scorecard?.verdict === "Strong"
                  ? "bg-emerald-100 text-emerald-700"
                  : insights.scorecard?.verdict === "Healthy"
                    ? "bg-sky-100 text-sky-700"
                    : insights.scorecard?.verdict === "Critical"
                      ? "bg-rose-100 text-rose-700"
                      : "bg-amber-100 text-amber-700",
              ].join(" ")}
            >
              {insights.scorecard?.verdict ?? "Watch"}
            </span>
          </div>

          <p className="mt-5 text-sm leading-7 text-slate-700">
            {insights.executiveBrief?.summary ??
              "The report will begin generating once enough current and prior data exists for a comparable read."}
          </p>

          {insights.scorecard && (
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <ScorePill
                label="Current growth"
                value={formatSignedPercent(insights.scorecard.currentChange)}
                tone={insights.scorecard.currentChange >= 0 ? "positive" : "warning"}
              />
              <ScorePill
                label="Growth speed"
                value={formatDeltaPoints(insights.scorecard.acceleration)}
                tone={
                  insights.scorecard.acceleration === null
                    ? "neutral"
                    : insights.scorecard.acceleration >= 0
                      ? "positive"
                      : "warning"
                }
              />
              <ScorePill
                label="Seasonal baseline"
                value={formatSignedPercent(insights.scorecard.seasonalDelta, "Limited history")}
                tone={
                  insights.scorecard.seasonalDelta === null
                    ? "neutral"
                    : insights.scorecard.seasonalDelta >= 0
                      ? "positive"
                      : "warning"
                }
              />
            </div>
          )}
        </section>

        <section className="rounded-[30px] border border-gray-200 bg-white p-6 lg:p-7">
          <div className="border-b border-gray-200 pb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Chair summary</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">What the room should hear first</h2>
          </div>

          <div className="mt-5 space-y-3">
            {chairSummary.map((point) => (
              <div key={point} className="rounded-2xl border border-gray-200 bg-[#fbfbfc] p-4 text-sm leading-6 text-slate-700">
                {point}
              </div>
            ))}
          </div>

          <div className="mt-5 border-t border-gray-200 pt-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Risk flags</p>
              <AlertTriangle className="h-4 w-4 text-[#c2410c]" />
            </div>

            <div className="mt-3 space-y-3">
              {riskFlags.map((flag) => (
                <div key={flag.title} className="rounded-2xl border border-gray-200 bg-[#fbfbfc] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-950">{flag.title}</p>
                    <span
                      className={[
                        "inline-flex rounded-full px-3 py-1 text-[11px] font-semibold",
                        flag.level === "High" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700",
                      ].join(" ")}
                    >
                      {flag.level}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{flag.detail}</p>
                </div>
              ))}
            </div>
          </div>

          {insights.scorecard?.dataCaveat && (
            <div className="mt-5 rounded-2xl border border-dashed border-gray-200 bg-[#fbfbfc] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Data caveat</p>
              <p className="mt-2 text-sm leading-6 text-gray-600">{insights.scorecard.dataCaveat}</p>
            </div>
          )}
        </section>
      </section>

      <DeepReportThesis report={deepReport} />

      <CampusDiagnosticDossiers dossiers={deepReport.campuses} />

      <ReportEvidenceMatrix report={deepReport} />

      <OperatingAgendaSection cards={insights.actionCards} />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.92fr)]">
        <section className="rounded-[30px] border border-gray-200 bg-white p-6 lg:p-7">
          <div className="flex items-start justify-between gap-4 border-b border-gray-200 pb-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Board talking points</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">Meeting-ready narrative</h2>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fbfbfc] text-slate-700">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {meetingTalkingPoints.map((point, index) => (
              <div key={`${index}-${point}`} className="flex gap-4 rounded-2xl border border-gray-200 bg-[#fbfbfc] p-4">
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-700">
                  {index + 1}
                </span>
                <p className="text-sm leading-6 text-slate-700">{point}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[30px] border border-gray-200 bg-white p-6 lg:p-7">
          <div className="flex items-start justify-between gap-4 border-b border-gray-200 pb-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Recommended decisions</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">Before next Sunday</h2>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff7ed] text-[#c2410c]">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {sundayDecisions.map((item) => (
              <div key={`${item.label}-${item.title}`} className="rounded-2xl border border-gray-200 bg-[#fbfbfc] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">{item.label}</p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">{item.title}</p>
                  </div>
                  <span className="inline-flex rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-600">
                    {item.priority}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-700">{item.detail}</p>
              </div>
            ))}
          </div>
        </section>
      </section>

      <section className="rounded-[30px] border border-gray-200 bg-white p-6 lg:p-7">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Campus reads</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">Portfolio performance by campus</h2>
            <p className="mt-2 text-xs text-gray-500">Lifecycle, growth speed, and seasonal context for the campuses in scope.</p>
          </div>
        </div>

        {insights.scorecard?.campuses.length ? (
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="py-4 pr-6 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Campus</th>
                  <th className="py-4 pr-6 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Lifecycle</th>
                  <th className="py-4 pr-6 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Verdict</th>
                  <th className="py-4 pr-6 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Current growth</th>
                  <th className="py-4 pr-6 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Growth speed</th>
                  <th className="py-4 pr-6 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Seasonal baseline</th>
                  <th className="py-4 pr-0 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Executive read</th>
                </tr>
              </thead>
              <tbody>
                {insights.scorecard.campuses.map((campus) => (
                  <tr key={campus.campus} className="border-b border-gray-200 align-top last:border-b-0">
                    <td className="py-4 pr-6 text-sm font-semibold text-slate-950">{campus.campus}</td>
                    <td className="py-4 pr-6 text-sm text-gray-500">{campus.lifecycle}</td>
                    <td className="py-4 pr-6">
                      <span className={verdictPillClass(campus.verdict)}>{campus.verdict}</span>
                    </td>
                    <td className="py-4 pr-6 text-sm text-slate-700">{formatSignedPercent(campus.currentChange)}</td>
                    <td className="py-4 pr-6 text-sm text-slate-700">{formatDeltaPoints(campus.acceleration)}</td>
                    <td className="py-4 pr-6 text-sm text-slate-700">{formatSignedPercent(campus.seasonalDelta, "Limited history")}</td>
                    <td className="py-4 pr-0 text-sm leading-6 text-slate-700">{campus.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-gray-200 bg-[#fbfbfc] p-4 text-sm text-gray-500">
            Not enough comparable history is available yet to build campus-level executive reads for this scope.
          </div>
        )}
      </section>

      {bigEventOverview && (
        <section className="rounded-[30px] border border-gray-200 bg-white p-6 lg:p-7">
          <div className="flex items-start justify-between gap-4 border-b border-gray-200 pb-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Big 5 event performance</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">Event lift, falloff, and forward view</h2>
              <p className="mt-2 max-w-3xl text-xs leading-6 text-gray-500">{bigEventOverview.summary}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.88fr)]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Completed event windows</p>
              <div className="mt-3 space-y-3">
                {bigEventOverview.completed.map((event) => (
                  <div key={event.event} className="rounded-2xl border border-gray-200 bg-[#fbfbfc] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">{event.event}</p>
                        <p className="mt-1 text-xs text-gray-500">{event.status} · {bigEventOverview.currentYear}</p>
                      </div>
                      <span
                        className={[
                          "inline-flex rounded-full px-3 py-1 text-[11px] font-semibold",
                          event.yoyChange !== null && event.yoyChange >= 0
                            ? "bg-emerald-100 text-emerald-700"
                            : event.yoyChange !== null
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-700",
                        ].join(" ")}
                      >
                        {event.yoyChange !== null
                          ? `${event.yoyChange > 0 ? "+" : ""}${event.yoyChange}% YoY`
                          : event.samePhaseDelta !== null
                            ? `${event.samePhaseDelta > 0 ? "+" : ""}${event.samePhaseDelta}% same-phase`
                            : "Waiting"}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <ReportMetric label="Current window" value={event.currentTotal ? event.currentTotal.toLocaleString() : "—"} />
                      <ReportMetric label="Prior year" value={event.priorTotal ? event.priorTotal.toLocaleString() : "—"} />
                      <ReportMetric label="Lift" value={formatSignedPercent(event.liftFromPreEvent, "N/A")} />
                      <ReportMetric label="Retention" value={event.retentionAfterEvent !== null ? `${event.retentionAfterEvent}%` : "N/A"} />
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-700">{event.explanation}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Forecasted upcoming events</p>
              <div className="mt-3 space-y-3">
                {bigEventOverview.upcoming.length > 0 ? (
                  bigEventOverview.upcoming.map((forecast) => (
                    <div key={forecast.event} className="rounded-2xl border border-gray-200 bg-[#fbfbfc] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-950">{forecast.event}</p>
                        <span className="inline-flex rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-600">
                          {forecast.trend}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <ReportMetric label="Low" value={forecast.forecastLow.toLocaleString()} />
                        <ReportMetric label="Base" value={forecast.forecastBase.toLocaleString()} />
                        <ReportMetric label="High" value={forecast.forecastHigh.toLocaleString()} />
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-700">{forecast.rationale}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-[#fbfbfc] p-4 text-sm leading-6 text-gray-500">
                    No upcoming Big 5 events are waiting on a forecast right now.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
        <section className="rounded-[30px] border border-gray-200 bg-white p-6 lg:p-7">
          <div className="flex items-start justify-between gap-4 border-b border-gray-200 pb-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Operational health</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">Coverage and engagement ratios</h2>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fbfbfc] text-slate-700">
              <Users className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {insights.health.slice(0, 6).map((health) => (
              <div key={health.campus} className="rounded-2xl border border-gray-200 bg-[#fbfbfc] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-950">{health.campus}</p>
                  <p className="text-sm text-gray-500">{health.attendance.toLocaleString()} attendance</p>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <RatioPill
                    label="Volunteer coverage"
                    value={formatRatioPercent(health.volunteerRatio)}
                    note={health.volunteerStatus}
                  />
                  <RatioPill
                    label="Guest rate"
                    value={formatRatioPercent(health.ftgRate)}
                    note={`${health.ftgStatus} · target ${formatRatioPercent(churchGrowthBenchmarks.firstTimeGuestRateMin)}-${formatRatioPercent(churchGrowthBenchmarks.firstTimeGuestRateMax)}`}
                  />
                  <RatioPill
                    label="Kids ratio"
                    value={formatRatioPercent(health.kidsRatio)}
                    note={`${health.kidsStatus} · target ${formatRatioPercent(churchGrowthBenchmarks.kidsRatioMin)}-${formatRatioPercent(churchGrowthBenchmarks.kidsRatioMax)}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[30px] border border-gray-200 bg-white p-6 lg:p-7">
          <div className="flex items-start justify-between gap-4 border-b border-gray-200 pb-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Context</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">Transitions and notable Sundays</h2>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fbfbfc] text-slate-700">
              <CalendarDays className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-5 space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Leadership transitions</p>
              <div className="mt-3 space-y-2">
                {insights.scorecard?.transitions.length ? (
                  insights.scorecard.transitions.map((transition) => (
                    <div
                      key={`${transition.campus}-${transition.date}-${transition.note}`}
                      className="rounded-2xl border border-gray-200 bg-[#fbfbfc] px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-950">{transition.campus}</p>
                        <span className="text-xs text-gray-500">{formatDateLabel(transition.date)}</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-700">
                        {transition.type} · {transition.timing}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-gray-600">{transition.note}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-[#fbfbfc] p-4 text-sm leading-6 text-gray-500">
                    No campus pastor or staff transitions are logged in this reporting window yet. Adding those events
                    will make the growth narrative more explainable in leadership meetings.
                  </div>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Notable Sundays</p>
              <div className="mt-3 space-y-2">
                {eventNotes.length > 0 ? (
                  eventNotes.map((event) => (
                    <div key={`${event.date}-${event.note}`} className="rounded-2xl border border-gray-200 bg-[#fbfbfc] px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm leading-6 text-slate-700">{event.note}</p>
                        <span className="text-xs text-gray-500 whitespace-nowrap">{formatDateLabel(event.date)}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-[#fbfbfc] p-4 text-sm leading-6 text-gray-500">
                    No event notes are attached to the current scope yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </section>
    </div>
  );
}

type ReportTone = "positive" | "warning" | "neutral";

type DeepReportSignal = {
  label: string;
  value: string;
  note: string;
  tone: ReportTone;
};

type CampusDiagnosticDossier = {
  campus: string;
  primaryPressure: string;
  confidence: "High" | "Medium" | "Directional";
  thesis: string;
  currentAttendance: number;
  priorAttendance: number;
  attendanceChange: number | null;
  selectedMetricTotal: number;
  selectedMetricChange: number | null;
  recentTrend: number | null;
  volunteerCoverage: number | null;
  kidsRatio: number | null;
  firstTimeGuestRate: number | null;
  evidence: string[];
  leadershipQuestions: string[];
  dataGaps: string[];
};

type DeepReport = {
  headline: string;
  thesis: string;
  interpretation: string;
  confidence: "High" | "Medium" | "Directional";
  portfolioSignals: DeepReportSignal[];
  campuses: CampusDiagnosticDossier[];
  questions: string[];
  dataNeeds: string[];
};

function DeepReportThesis({ report }: { report: DeepReport }) {
  return (
    <section className="rounded-[30px] border border-gray-200 bg-white p-6 lg:p-7">
      <div className="flex items-start justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Deep report layer</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">{report.headline}</h2>
          <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-700">{report.thesis}</p>
        </div>
        <span
          className={[
            "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
            report.confidence === "High"
              ? "bg-emerald-100 text-emerald-700"
              : report.confidence === "Medium"
                ? "bg-sky-100 text-sky-700"
                : "bg-amber-100 text-amber-700",
          ].join(" ")}
        >
          {report.confidence} confidence
        </span>
      </div>

      <p className="mt-5 text-sm leading-7 text-slate-700">{report.interpretation}</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {report.portfolioSignals.map((signal) => (
          <div key={signal.label} className="rounded-2xl border border-gray-200 bg-[#fbfbfc] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">{signal.label}</p>
            <p
              className={[
                "mt-3 text-xl font-semibold tracking-[-0.04em]",
                signal.tone === "positive" ? "text-emerald-700" : signal.tone === "warning" ? "text-rose-700" : "text-slate-950",
              ].join(" ")}
            >
              {signal.value}
            </p>
            <p className="mt-2 text-xs leading-5 text-gray-500">{signal.note}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-[#fbfbfc] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Executive questions</p>
          <div className="mt-3 space-y-2">
            {report.questions.map((question) => (
              <p key={question} className="rounded-xl bg-white px-3 py-2 text-sm leading-6 text-slate-700">{question}</p>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-gray-200 bg-[#fbfbfc] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Data that would deepen the read</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {report.dataNeeds.map((item) => (
              <span key={item} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600">{item}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function CampusDiagnosticDossiers({ dossiers }: { dossiers: CampusDiagnosticDossier[] }) {
  if (dossiers.length === 0) return null;

  return (
    <section className="rounded-[30px] border border-gray-200 bg-white p-6 lg:p-7">
      <div className="flex items-start justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Campus diagnostic dossiers</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">What appears to be driving each campus</h2>
          <p className="mt-2 max-w-3xl text-xs leading-6 text-gray-500">
            These are deeper reads than the dashboard cards. They separate measured evidence from the operating theory leadership should pressure-test.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {dossiers.map((dossier) => (
          <article key={dossier.campus} className="rounded-2xl border border-gray-200 bg-[#fbfbfc] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold tracking-[-0.04em] text-slate-950">{dossier.campus}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">{dossier.primaryPressure}</p>
              </div>
              <span
                className={[
                  "inline-flex rounded-full px-3 py-1 text-[11px] font-semibold",
                  dossier.confidence === "High"
                    ? "bg-emerald-100 text-emerald-700"
                    : dossier.confidence === "Medium"
                      ? "bg-sky-100 text-sky-700"
                      : "bg-amber-100 text-amber-700",
                ].join(" ")}
              >
                {dossier.confidence}
              </span>
            </div>

            <p className="mt-4 text-sm leading-7 text-slate-700">{dossier.thesis}</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <ReportMetric label="Attendance" value={`${dossier.currentAttendance.toLocaleString()}${dossier.attendanceChange === null ? "" : ` (${formatSignedPercent(dossier.attendanceChange)})`}`} />
              <ReportMetric label="Selected metric" value={`${dossier.selectedMetricTotal.toLocaleString()}${dossier.selectedMetricChange === null ? "" : ` (${formatSignedPercent(dossier.selectedMetricChange)})`}`} />
              <ReportMetric label="Recent 4-week trend" value={formatSignedPercent(dossier.recentTrend, "N/A")} />
              <ReportMetric label="Volunteer coverage" value={formatRatioPercentOptional(dossier.volunteerCoverage)} />
              <ReportMetric label="Kids ratio" value={formatRatioPercentOptional(dossier.kidsRatio)} />
              <ReportMetric label="FTG rate" value={formatRatioPercentOptional(dossier.firstTimeGuestRate)} />
            </div>

            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Evidence chain</p>
              {dossier.evidence.map((item) => (
                <p key={item} className="rounded-xl bg-white px-3 py-2 text-xs leading-5 text-gray-600">{item}</p>
              ))}
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Leadership questions</p>
                <div className="mt-2 space-y-2">
                  {dossier.leadershipQuestions.map((question) => (
                    <p key={question} className="text-sm leading-6 text-slate-700">{question}</p>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Missing context</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {dossier.dataGaps.map((gap) => (
                    <span key={gap} className="rounded-full bg-[#fbfbfc] px-3 py-1 text-xs font-medium text-slate-600">{gap}</span>
                  ))}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ReportEvidenceMatrix({ report }: { report: DeepReport }) {
  if (report.campuses.length === 0) return null;

  return (
    <section className="rounded-[30px] border border-gray-200 bg-white p-6 lg:p-7">
      <div className="border-b border-gray-200 pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Evidence matrix</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">Signals by campus</h2>
        <p className="mt-2 text-xs leading-6 text-gray-500">
          A concise diagnostic table for spotting whether the issue looks like reach, connection, capacity, seasonality, or data confidence.
        </p>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="min-w-full text-left">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-4 pr-6 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Campus</th>
              <th className="py-4 pr-6 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Primary read</th>
              <th className="py-4 pr-6 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Attendance</th>
              <th className="py-4 pr-6 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Recent trend</th>
              <th className="py-4 pr-6 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Capacity</th>
              <th className="py-4 pr-0 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {report.campuses.map((campus) => (
              <tr key={campus.campus} className="border-b border-gray-200 align-top last:border-b-0">
                <td className="py-4 pr-6 text-sm font-semibold text-slate-950">{campus.campus}</td>
                <td className="py-4 pr-6 text-sm text-slate-700">{campus.primaryPressure}</td>
                <td className="py-4 pr-6 text-sm text-slate-700">{formatSignedPercent(campus.attendanceChange, "N/A")}</td>
                <td className="py-4 pr-6 text-sm text-slate-700">{formatSignedPercent(campus.recentTrend, "N/A")}</td>
                <td className="py-4 pr-6 text-sm text-slate-700">
                  Volunteer {formatRatioPercentOptional(campus.volunteerCoverage)} · Kids {formatRatioPercentOptional(campus.kidsRatio)}
                </td>
                <td className="py-4 pr-0 text-sm text-slate-700">{campus.confidence}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function OperatingAgendaSection({ cards }: { cards: ReturnType<typeof getDashboardInsights>["actionCards"] }) {
  if (cards.length === 0) return null;

  return (
    <section className="rounded-[30px] border border-gray-200 bg-white p-6 lg:p-7">
      <div className="flex items-start justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Executive operating agenda</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">Decisions, evidence, and next moves</h2>
          <p className="mt-2 max-w-3xl text-xs leading-6 text-gray-500">
            These cards translate the analysis into what leadership should decide, what evidence supports the read,
            and what data would confirm or disprove it.
          </p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fbfbfc] text-slate-700">
          <Sparkles className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {cards.map((card) => (
          <div key={`${card.campus}-${card.lens}-${card.title}`} className="rounded-2xl border border-gray-200 bg-[#fbfbfc] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">{card.title}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">{card.lens}</p>
              </div>
              <span
                className={[
                  "inline-flex rounded-full px-3 py-1 text-[11px] font-semibold whitespace-nowrap",
                  card.urgency === "Decide now"
                    ? "bg-rose-100 text-rose-700"
                    : card.urgency === "This week"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-slate-100 text-slate-700",
                ].join(" ")}
              >
                {card.urgency}
              </span>
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-700">{card.diagnosis}</p>

            <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Working theory</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{card.hypothesis}</p>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Decision</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{card.decision}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Next move</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{card.nextMove}</p>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Evidence</p>
              {card.evidence.slice(0, 4).map((item) => (
                <p key={item} className="rounded-xl bg-white px-3 py-2 text-xs leading-5 text-gray-600">{item}</p>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-dashed border-gray-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Data to confirm</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {card.dataToConfirm.map((item) => (
                  <span key={item} className="rounded-full bg-[#fbfbfc] px-3 py-1 text-xs font-medium text-slate-600">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function buildMeetingTalkingPoints(
  insights: ReturnType<typeof getDashboardInsights>,
  scopeLabel: string,
) {
  const points: string[] = [];

  if (insights.scorecard) {
    points.push(
      `${scopeLabel} is currently rated ${insights.scorecard.verdict.toLowerCase()}, with ${insights.metricLabel.toLowerCase()} ${formatSignedPercent(insights.scorecard.currentChange).toLowerCase()} versus the comparable prior window through the Reach, Connection, and Capacity framework.`,
    );

    if (insights.scorecard.acceleration !== null) {
      points.push(
        insights.scorecard.acceleration >= 0
          ? `Growth speed is improving, which suggests the current trend has more underlying strength than a simple one-period spike.`
          : `Growth speed is slowing, which means topline growth should be pressure-tested against seasonality, staffing changes, and serving capacity before it is treated as durable momentum.`,
      );
    }
  }

  insights.actionCards.slice(0, 2).forEach((card) => {
    points.push(`${card.lens}: ${card.title}. ${card.hypothesis} Decision needed: ${card.decision}`);
  });

  if (insights.actionCards.length === 0) {
    insights.findings.slice(0, 2).forEach((finding) => {
      points.push(`${finding.lens}: ${finding.title}. ${finding.detail}`);
    });
  }

  if (insights.health.length > 0) {
    const weakestCoverage = [...insights.health].sort((left, right) => left.volunteerRatio - right.volunteerRatio)[0];
    points.push(
      `${weakestCoverage.campus} has the thinnest volunteer coverage in scope at ${formatRatioPercent(weakestCoverage.volunteerRatio)}, which should be reviewed before growth goals are raised further.`,
    );
  }

  if (points.length === 0 && insights.executiveBrief) {
    points.push(insights.executiveBrief.summary);
  }

  return points.slice(0, 4);
}

function buildChairSummary(
  insights: ReturnType<typeof getDashboardInsights>,
  scopeLabel: string,
) {
  const summary: string[] = [];

  if (insights.scorecard) {
    summary.push(
      `${scopeLabel} is currently ${insights.scorecard.verdict.toLowerCase()}, with ${formatSignedPercent(insights.scorecard.currentChange).toLowerCase()} ${insights.metricLabel.toLowerCase()} versus the same point in the prior comparison window.`,
    );

    if (insights.scorecard.acceleration !== null) {
      summary.push(
        insights.scorecard.acceleration >= 0
          ? `Growth speed is improving, which is a stronger signal than topline growth alone and suggests the trend has operational support behind it.`
          : `Growth speed is slowing, so the executive question is whether the softness is seasonal, leadership-context related, or a real connection/capacity issue.`,
      );
    }
  }

  if (insights.actionCards[0]) {
    summary.push(`${insights.actionCards[0].hypothesis} ${insights.actionCards[0].nextMove}`);
  } else if (insights.findings[0]) {
    summary.push(insights.findings[0].detail);
  }

  if (summary.length === 0 && insights.executiveBrief) {
    summary.push(insights.executiveBrief.summary);
  }

  return summary.slice(0, 3);
}

function buildRiskFlags(
  insights: ReturnType<typeof getDashboardInsights>,
  scopeLabel: string,
) {
  const flags: Array<{ title: string; detail: string; level: "High" | "Watch" }> = [];

  insights.actionCards
    .filter((card) => card.urgency === "Decide now")
    .slice(0, 2)
    .forEach((card) => {
      flags.push({
        title: card.title,
        detail: `${card.hypothesis} ${card.decision}`,
        level: "High",
      });
    });

  if ((insights.scorecard?.acceleration ?? 0) < -5) {
    flags.push({
      title: "Momentum is slowing",
      detail: `${scopeLabel} is still moving, but the speed of growth has softened enough to warrant a closer read before leadership assumes the current pace will hold.`,
      level: "High",
    });
  }

  const weakestCoverage = insights.health.length
    ? [...insights.health].sort((left, right) => left.volunteerRatio - right.volunteerRatio)[0]
    : null;

  if (weakestCoverage && weakestCoverage.volunteerRatio < churchGrowthBenchmarks.weeklyVolunteerCoverageWatch) {
    flags.push({
      title: `${weakestCoverage.campus} is capacity-constrained`,
      detail: `Weekly volunteer coverage is ${formatRatioPercent(weakestCoverage.volunteerRatio)}, below the ${formatRatioPercent(churchGrowthBenchmarks.weeklyVolunteerCoverageWatch)} watch line. Further growth without serving depth could create quality or retention pressure.`,
      level: "High",
    });
  }

  const downTrend = insights.trendAlerts.find((alert) => alert.direction === "down");
  if (downTrend) {
    flags.push({
      title: `${downTrend.campus} has a recent ${downTrend.metricLabel.toLowerCase()} slide`,
      detail: `The last 4 weeks are ${formatSignedPercent(downTrend.pctChange).toLowerCase()} versus the prior 4-week baseline, which deserves review before the next meeting packet closes.`,
      level: "Watch",
    });
  }

  if ((insights.scorecard?.transitions.length ?? 0) === 0) {
    flags.push({
      title: "Leadership-change context is missing",
      detail: "The report can identify shifts, but it still cannot explain whether a campus pastor or staff transition sits behind them until those events are logged.",
      level: "Watch",
    });
  }

  if (flags.length === 0) {
    flags.push({
      title: "No major structural risk is surfacing",
      detail: "Current signals do not point to a sharp deterioration in momentum, capacity, or seasonal performance. Continue normal monitoring.",
      level: "Watch",
    });
  }

  return flags.slice(0, 4);
}

function buildSundayDecisions(
  insights: ReturnType<typeof getDashboardInsights>,
  scopeLabel: string,
) {
  const items: Array<{ label: string; title: string; detail: string; priority: "Now" | "This week" | "Monitor" }> = [];

  insights.actionCards.slice(0, 3).forEach((card) => {
    items.push({
      label: card.lens,
      title: card.title,
      detail: `${card.decision} Next move: ${card.nextMove}`,
      priority: card.urgency === "Decide now" ? "Now" : card.urgency,
    });
  });

  if (items.length === 0) {
    insights.findings
      .filter((finding) => finding.tone === "warning")
      .slice(0, 2)
      .forEach((finding) => {
      items.push({
        label: finding.lens,
        title: finding.title,
        detail: finding.detail,
        priority: "Now",
      });
    });
  }

  const seasonalDelta = insights.scorecard?.seasonalDelta ?? null;

  if (seasonalDelta !== null && seasonalDelta < -5) {
    items.push({
      label: "Seasonality",
      title: "Plan a low-season attendance push",
      detail: `${scopeLabel} is running ${Math.abs(seasonalDelta)}% below seasonal baseline. Build a focused 4-6 week attendance and guest-engagement push before the next review cycle.`,
      priority: "This week",
    });
  }

  const weakestCoverage = insights.health.length
    ? [...insights.health].sort((left, right) => left.volunteerRatio - right.volunteerRatio)[0]
    : null;

  if (weakestCoverage && weakestCoverage.volunteerRatio < churchGrowthBenchmarks.weeklyVolunteerCoverageWatch) {
    items.push({
      label: "Capacity",
      title: `Pressure-test serving depth at ${weakestCoverage.campus}`,
      detail: `Weekly volunteer coverage is ${formatRatioPercent(weakestCoverage.volunteerRatio)}, below the ${formatRatioPercent(churchGrowthBenchmarks.weeklyVolunteerCoverageWatch)} watch line. Leadership should confirm whether the campus can absorb further growth without service quality slipping.`,
      priority: "This week",
    });
  }

  if ((insights.scorecard?.transitions.length ?? 0) === 0) {
    items.push({
      label: "Data discipline",
      title: "Start logging campus pastor and staff transitions",
      detail: "The report can flag momentum shifts, but it still cannot reliably explain them without CP and staff-change context in the dataset.",
      priority: "Monitor",
    });
  }

  if (items.length === 0) {
    items.push({
      label: "Operating posture",
      title: "Keep the current plan in place",
      detail: "No immediate intervention is required from the current scorecard. Continue monitoring growth speed, seasonal baseline, and volunteer coverage in the next report cycle.",
      priority: "Monitor",
    });
  }

  return items.slice(0, 4);
}

const reportFieldMap: Record<KpiKey, keyof ReportTotals> = {
  attendance: "attendance",
  volunteers: "volunteers",
  firstTimeGuests: "firstTimeGuests",
  salvations: "salvations",
  kids: "kids",
  growthTrack: "growthTrack",
  baptism: "baptism",
};

type ReportTotals = {
  attendance: number;
  volunteers: number;
  firstTimeGuests: number;
  salvations: number;
  kids: number;
  growthTrack: number;
  baptism: number;
};

function buildDeepReport(
  metrics: SundayMetric[],
  filters: ComparisonFilters,
  insights: ReturnType<typeof getDashboardInsights>,
  scopeLabel: string,
): DeepReport {
  const campuses = filters.selectedCampuses.filter(Boolean);
  const scopedCampuses = campuses.length > 0 ? campuses : getAvailableCampuses(metrics);
  const priorPeriod = filters.periodB ?? deriveReportPriorPeriod(filters.periodA);
  const cutoffMonthDay = priorPeriod ? getReportCutoffMonthDay(metrics, scopedCampuses, filters.periodA) : null;
  const currentRecords = getReportPeriodRecords(metrics, filters.periodA).filter((record) => scopedCampuses.includes(record.campus));
  const priorRecords = priorPeriod
    ? getReportPeriodRecords(metrics, priorPeriod, cutoffMonthDay).filter((record) => scopedCampuses.includes(record.campus))
    : [];
  const currentTotals = aggregateReportTotals(currentRecords);
  const priorTotals = aggregateReportTotals(priorRecords);
  const selectedField = reportFieldMap[filters.metric];
  const selectedMetricChange = pctChange(currentTotals[selectedField], priorTotals[selectedField]);
  const attendanceChange = pctChange(currentTotals.attendance, priorTotals.attendance);
  const volunteerCoverage = safeRatio(currentTotals.volunteers, currentTotals.attendance);
  const kidsRatio = safeRatio(currentTotals.kids, currentTotals.attendance);
  const firstTimeGuestRate = safeRatio(currentTotals.firstTimeGuests, currentTotals.attendance);
  const reportCampuses = scopedCampuses
    .map((campus) => buildCampusDiagnosticDossier(metrics, filters, insights, campus, priorPeriod, cutoffMonthDay))
    .filter((dossier): dossier is CampusDiagnosticDossier => dossier !== null);
  const weakestCampus = [...reportCampuses].sort((left, right) => {
    const leftScore = Math.min(left.attendanceChange ?? 0, left.recentTrend ?? 0);
    const rightScore = Math.min(right.attendanceChange ?? 0, right.recentTrend ?? 0);
    return leftScore - rightScore;
  })[0];
  const capacityCampus = [...reportCampuses]
    .filter((campus) => campus.volunteerCoverage !== null)
    .sort((left, right) => (left.volunteerCoverage ?? 1) - (right.volunteerCoverage ?? 1))[0];
  const confidence = getPortfolioConfidence(reportCampuses);
  const primaryStory =
    selectedMetricChange === null
      ? `${scopeLabel} has current-period data, but not enough aligned prior-period data to make a reliable year-over-year call.`
      : selectedMetricChange >= 8
        ? `${scopeLabel} is showing measurable growth, but the report still pressure-tests whether that growth is supported by volunteer depth, kids capacity, and next-step movement.`
        : selectedMetricChange <= -5
          ? `${scopeLabel} is under the aligned comparison window. The deeper read is whether the softness is concentrated in reach, connection, capacity, or seasonality rather than assuming the top-line decline explains itself.`
          : `${scopeLabel} is broadly stable against the aligned comparison window, so the report is looking for hidden constraints, plateaus, and campus-level divergence.`;

  const interpretationParts = [
    selectedMetricChange !== null
      ? `Selected metric movement is ${formatSignedPercent(selectedMetricChange)} versus the aligned prior window.`
      : null,
    attendanceChange !== null
      ? `Attendance is ${formatSignedPercent(attendanceChange)} on the same basis, which keeps the read anchored to each campus's own baseline instead of comparing smaller campuses to larger ones.`
      : null,
    capacityCampus && capacityCampus.volunteerCoverage !== null
      ? `${capacityCampus.campus} has the thinnest visible volunteer coverage at ${formatRatioPercent(capacityCampus.volunteerCoverage)}, so capacity should be checked before asking that campus to absorb more growth.`
      : null,
    weakestCampus && weakestCampus.campus
      ? `${weakestCampus.campus} deserves the first campus-level discussion because its combined YoY/recent trend signal is the softest in scope.`
      : null,
  ].filter((part): part is string => Boolean(part));

  return {
    headline: buildDeepReportHeadline(scopeLabel, selectedMetricChange, confidence),
    thesis: primaryStory,
    interpretation: interpretationParts.join(" "),
    confidence,
    portfolioSignals: [
      {
        label: "Selected metric",
        value: selectedMetricChange === null ? "No baseline" : formatSignedPercent(selectedMetricChange),
        note: `${currentTotals[selectedField].toLocaleString()} current vs ${priorTotals[selectedField].toLocaleString()} prior-aligned`,
        tone: getToneForChange(selectedMetricChange),
      },
      {
        label: "Attendance",
        value: attendanceChange === null ? "No baseline" : formatSignedPercent(attendanceChange),
        note: `${currentTotals.attendance.toLocaleString()} current vs ${priorTotals.attendance.toLocaleString()} prior-aligned`,
        tone: getToneForChange(attendanceChange),
      },
      {
        label: "Volunteer coverage",
        value: volunteerCoverage === null ? "N/A" : formatRatioPercent(volunteerCoverage),
        note: `Watch line ${formatRatioPercent(churchGrowthBenchmarks.weeklyVolunteerCoverageWatch)} · healthy ${formatRatioPercent(churchGrowthBenchmarks.weeklyVolunteerCoverageHealthy)}+`,
        tone: volunteerCoverage === null ? "neutral" : volunteerCoverage < churchGrowthBenchmarks.weeklyVolunteerCoverageWatch ? "warning" : "positive",
      },
      {
        label: "Guest flow",
        value: firstTimeGuestRate === null ? "N/A" : formatRatioPercent(firstTimeGuestRate),
        note: `Reach range ${formatRatioPercent(churchGrowthBenchmarks.firstTimeGuestRateMin)}-${formatRatioPercent(churchGrowthBenchmarks.firstTimeGuestRateMax)} of attendance`,
        tone: firstTimeGuestRate === null ? "neutral" : firstTimeGuestRate < churchGrowthBenchmarks.firstTimeGuestRateMin ? "warning" : "positive",
      },
    ],
    campuses: reportCampuses,
    questions: buildPortfolioQuestions(reportCampuses, selectedMetricChange, attendanceChange),
    dataNeeds: buildPortfolioDataNeeds(reportCampuses, kidsRatio, firstTimeGuestRate),
  };
}

function buildCampusDiagnosticDossier(
  metrics: SundayMetric[],
  filters: ComparisonFilters,
  insights: ReturnType<typeof getDashboardInsights>,
  campus: string,
  priorPeriod: Period | null,
  cutoffMonthDay: string | null,
): CampusDiagnosticDossier | null {
  const currentRecords = getReportPeriodRecords(metrics, filters.periodA).filter((record) => record.campus === campus);
  if (currentRecords.length === 0) return null;

  const priorRecords = priorPeriod
    ? getReportPeriodRecords(metrics, priorPeriod, cutoffMonthDay).filter((record) => record.campus === campus)
    : [];
  const currentTotals = aggregateReportTotals(currentRecords);
  const priorTotals = aggregateReportTotals(priorRecords);
  const selectedField = reportFieldMap[filters.metric];
  const selectedMetricChange = pctChange(currentTotals[selectedField], priorTotals[selectedField]);
  const attendanceChange = pctChange(currentTotals.attendance, priorTotals.attendance);
  const volunteerCoverage = safeRatio(currentTotals.volunteers, currentTotals.attendance);
  const kidsRatio = safeRatio(currentTotals.kids, currentTotals.attendance);
  const firstTimeGuestRate = safeRatio(currentTotals.firstTimeGuests, currentTotals.attendance);
  const recentTrend = getRecentFourWeekTrend(currentRecords, selectedField);
  const actionCard = insights.actionCards.find((card) => card.campus === campus);
  const scorecardRead = insights.scorecard?.campuses.find((row) => row.campus === campus);
  const primaryPressure = actionCard?.lens ?? classifyCampusPressure(attendanceChange, recentTrend, volunteerCoverage, kidsRatio, firstTimeGuestRate);
  const confidence = getCampusConfidence(currentTotals, priorTotals, recentTrend, actionCard?.dataToConfirm.length ?? 0);
  const thesis = actionCard?.hypothesis ?? buildCampusThesis(campus, primaryPressure, attendanceChange, recentTrend, volunteerCoverage, firstTimeGuestRate);

  return {
    campus,
    primaryPressure,
    confidence,
    thesis,
    currentAttendance: currentTotals.attendance,
    priorAttendance: priorTotals.attendance,
    attendanceChange,
    selectedMetricTotal: currentTotals[selectedField],
    selectedMetricChange,
    recentTrend,
    volunteerCoverage,
    kidsRatio,
    firstTimeGuestRate,
    evidence: buildCampusEvidence(campus, currentTotals, priorTotals, selectedField, selectedMetricChange, attendanceChange, recentTrend, volunteerCoverage, kidsRatio, firstTimeGuestRate, scorecardRead?.reason),
    leadershipQuestions: buildCampusQuestions(primaryPressure, campus),
    dataGaps: buildCampusDataGaps(currentTotals, actionCard?.dataToConfirm ?? []),
  };
}

function buildDeepReportHeadline(scopeLabel: string, selectedMetricChange: number | null, confidence: DeepReport["confidence"]) {
  if (selectedMetricChange === null) return `${scopeLabel}: deeper read requires a comparable baseline`;
  if (selectedMetricChange >= 8) return `${scopeLabel}: growth is present, now test whether it is durable`;
  if (selectedMetricChange <= -5) return `${scopeLabel}: softness needs root-cause separation`;
  return `${scopeLabel}: stable topline, deeper operating questions remain`;
}

function buildCampusThesis(
  campus: string,
  primaryPressure: string,
  attendanceChange: number | null,
  recentTrend: number | null,
  volunteerCoverage: number | null,
  firstTimeGuestRate: number | null,
) {
  const trendRead = attendanceChange === null ? "without enough prior-year baseline" : `with attendance ${formatSignedPercent(attendanceChange)} year over year`;
  const recentRead = recentTrend === null ? "recent momentum is not yet readable" : `recent four-week movement is ${formatSignedPercent(recentTrend)}`;

  if (primaryPressure === "Capacity") {
    return `${campus} is operating ${trendRead}, but the stronger leadership question is capacity. Volunteer coverage is ${formatRatioPercentOptional(volunteerCoverage)}, so the team should confirm Sunday serving depth before interpreting growth or decline as only a reach problem.`;
  }

  if (primaryPressure === "Connection") {
    return `${campus} is operating ${trendRead}, and the most important question is whether people are moving from attendance into next steps. ${recentRead}; cohort-level follow-up, Growth Track, baptism, and serve handoff data would sharpen the call.`;
  }

  if (primaryPressure === "Reach") {
    return `${campus} is operating ${trendRead}, and first-time guest flow is ${formatRatioPercentOptional(firstTimeGuestRate)} of attendance. The immediate read is reach pressure unless follow-up or capacity data points to a stronger internal constraint.`;
  }

  if (primaryPressure === "Seasonality") {
    return `${campus} is operating ${trendRead}. The pattern should be compared against the same weeks in prior years, Big 5 timing, and post-event falloff before leadership treats it as a structural decline.`;
  }

  return `${campus} is operating ${trendRead}; ${recentRead}. The report does not see a single dominant pressure yet, so leadership should treat this as a focused diagnostic conversation rather than a finished conclusion.`;
}

function buildCampusEvidence(
  campus: string,
  currentTotals: ReportTotals,
  priorTotals: ReportTotals,
  selectedField: keyof ReportTotals,
  selectedMetricChange: number | null,
  attendanceChange: number | null,
  recentTrend: number | null,
  volunteerCoverage: number | null,
  kidsRatio: number | null,
  firstTimeGuestRate: number | null,
  scorecardReason?: string,
) {
  const evidence = [
    `${campus} has ${currentTotals.attendance.toLocaleString()} attendance in scope versus ${priorTotals.attendance.toLocaleString()} prior-aligned (${formatSignedPercent(attendanceChange, "no baseline")}).`,
    `Selected metric total is ${currentTotals[selectedField].toLocaleString()} versus ${priorTotals[selectedField].toLocaleString()} prior-aligned (${formatSignedPercent(selectedMetricChange, "no baseline")}).`,
    recentTrend !== null ? `The latest four-week trend is ${formatSignedPercent(recentTrend)} versus the previous four-week local baseline.` : null,
    volunteerCoverage !== null ? `Volunteer coverage is ${formatRatioPercent(volunteerCoverage)} against a ${formatRatioPercent(churchGrowthBenchmarks.weeklyVolunteerCoverageWatch)} watch line.` : null,
    kidsRatio !== null ? `Kids ratio is ${formatRatioPercent(kidsRatio)} against the ${formatRatioPercent(churchGrowthBenchmarks.kidsRatioMin)}-${formatRatioPercent(churchGrowthBenchmarks.kidsRatioMax)} family-health range.` : null,
    firstTimeGuestRate !== null ? `First-time guest flow is ${formatRatioPercent(firstTimeGuestRate)} of attendance against the ${formatRatioPercent(churchGrowthBenchmarks.firstTimeGuestRateMin)}-${formatRatioPercent(churchGrowthBenchmarks.firstTimeGuestRateMax)} reach range.` : null,
    scorecardReason ?? null,
  ].filter((item): item is string => Boolean(item));

  return evidence.slice(0, 6);
}

function buildCampusQuestions(primaryPressure: string, campus: string) {
  if (primaryPressure === "Capacity") {
    return [
      `Which service at ${campus} is most constrained by serving teams, kids rooms, parking, or lobby flow?`,
      `Would adding attendance pressure improve outcomes, or would it worsen experience quality right now?`,
    ];
  }

  if (primaryPressure === "Connection") {
    return [
      `How many first-time guests at ${campus} returned for a second visit within 30 days?`,
      `Where is the handoff breaking: follow-up, Growth Track invite, Growth Track attendance, baptism, serving, or groups?`,
    ];
  }

  if (primaryPressure === "Reach") {
    return [
      `What is the next intentional invite or outreach lever for ${campus}, and who owns it?`,
      `Is the softness broad-based or concentrated around a service time, series, event window, or local calendar pattern?`,
    ];
  }

  if (primaryPressure === "Seasonality") {
    return [
      `Is the current dip normal for this campus in the same weeks across the last three years?`,
      `What counter-seasonal push is worth testing before the next major event window?`,
    ];
  }

  return [
    `What changed operationally at ${campus} during this window that is not yet reflected in the data?`,
    `What is the one follow-up dataset that would most improve confidence before the next executive review?`,
  ];
}

function buildCampusDataGaps(currentTotals: ReportTotals, actionDataNeeds: string[]) {
  const gaps = new Set(actionDataNeeds);

  if (currentTotals.growthTrack > currentTotals.firstTimeGuests && currentTotals.firstTimeGuests > 0) {
    gaps.add("Cohort-compatible Growth Track data");
  }

  if (currentTotals.volunteers === 0) gaps.add("Volunteer check-ins by service");
  if (currentTotals.firstTimeGuests === 0) gaps.add("First-time guest source and follow-up");
  gaps.add("Leadership/staff transition notes");
  gaps.add("Service-time level trend");

  return Array.from(gaps).slice(0, 6);
}

function buildPortfolioQuestions(
  campuses: CampusDiagnosticDossier[],
  selectedMetricChange: number | null,
  attendanceChange: number | null,
) {
  const weakest = campuses
    .filter((campus) => campus.attendanceChange !== null || campus.recentTrend !== null)
    .sort((left, right) => Math.min(left.attendanceChange ?? 0, left.recentTrend ?? 0) - Math.min(right.attendanceChange ?? 0, right.recentTrend ?? 0))[0];
  const capacity = campuses
    .filter((campus) => campus.volunteerCoverage !== null)
    .sort((left, right) => (left.volunteerCoverage ?? 1) - (right.volunteerCoverage ?? 1))[0];

  return [
    selectedMetricChange !== null && attendanceChange !== null
      ? `Is the selected metric moving with attendance (${formatSignedPercent(attendanceChange)}) or separating from it (${formatSignedPercent(selectedMetricChange)})?`
      : `Do we have enough aligned prior-period data to separate a true trend from an incomplete data window?`,
    weakest ? `What is the clearest explanation for ${weakest.campus}'s softest signal: reach, connection, capacity, seasonality, or transition context?` : `Which campus deserves the first read once more history is imported?`,
    capacity ? `Can ${capacity.campus} absorb more growth with volunteer coverage at ${formatRatioPercentOptional(capacity.volunteerCoverage)}?` : `Do we have reliable volunteer coverage by service?`,
  ];
}

function buildPortfolioDataNeeds(campuses: CampusDiagnosticDossier[], kidsRatio: number | null, firstTimeGuestRate: number | null) {
  const needs = new Set<string>([
    "Service-time attendance by campus",
    "Volunteer check-ins by team",
    "First-time guest cohort follow-up",
    "Growth Track signup and completion cohorts",
    "Campus pastor/staff transition log",
  ]);

  if (kidsRatio === null) needs.add("Kids attendance by service");
  if (firstTimeGuestRate === null) needs.add("Invite source and guest tags");
  if (campuses.some((campus) => campus.confidence === "Directional")) needs.add("Data completeness review");

  return Array.from(needs).slice(0, 8);
}

function classifyCampusPressure(
  attendanceChange: number | null,
  recentTrend: number | null,
  volunteerCoverage: number | null,
  kidsRatio: number | null,
  firstTimeGuestRate: number | null,
) {
  if (
    (volunteerCoverage !== null && volunteerCoverage < churchGrowthBenchmarks.weeklyVolunteerCoverageWatch) ||
    (kidsRatio !== null && kidsRatio > churchGrowthBenchmarks.kidsRatioMax * 1.15)
  ) {
    return "Capacity";
  }

  if (firstTimeGuestRate !== null && firstTimeGuestRate < churchGrowthBenchmarks.firstTimeGuestRateMin) {
    return "Reach";
  }

  if ((attendanceChange ?? 0) < -5 || (recentTrend ?? 0) < -8) {
    return "Seasonality";
  }

  return "Connection";
}

function getPortfolioConfidence(campuses: CampusDiagnosticDossier[]): DeepReport["confidence"] {
  if (campuses.length === 0) return "Directional";
  const highCount = campuses.filter((campus) => campus.confidence === "High").length;
  const directionalCount = campuses.filter((campus) => campus.confidence === "Directional").length;

  if (highCount >= Math.ceil(campuses.length * 0.6)) return "High";
  if (directionalCount >= Math.ceil(campuses.length * 0.5)) return "Directional";
  return "Medium";
}

function getCampusConfidence(
  currentTotals: ReportTotals,
  priorTotals: ReportTotals,
  recentTrend: number | null,
  dataNeedCount: number,
): CampusDiagnosticDossier["confidence"] {
  const hasPrior = priorTotals.attendance > 0;
  const hasHealthRatios = currentTotals.volunteers > 0 && currentTotals.firstTimeGuests > 0;

  if (hasPrior && recentTrend !== null && hasHealthRatios && dataNeedCount <= 3) return "High";
  if (hasPrior && (recentTrend !== null || hasHealthRatios)) return "Medium";
  return "Directional";
}

function getReportPeriodRecords(metrics: SundayMetric[], period: Period, cutoffMonthDay?: string | null) {
  return metrics.filter((metric) => {
    const date = new Date(`${metric.service_date}T00:00:00`);
    if (Number.isNaN(date.getTime())) return false;
    const year = String(date.getFullYear());
    const month = date.getMonth() + 1;
    if (year !== period.year) return false;
    if (period.month && month !== period.month) return false;
    if (period.quarter && Math.ceil(month / 3) !== period.quarter) return false;
    if (cutoffMonthDay && metric.service_date.slice(5) > cutoffMonthDay) return false;
    return true;
  });
}

function getReportCutoffMonthDay(metrics: SundayMetric[], campuses: string[], period: Period) {
  const latestDate = getReportPeriodRecords(metrics, period)
    .filter((metric) => campuses.includes(metric.campus))
    .map((metric) => metric.service_date)
    .sort()
    .at(-1);
  return latestDate ? latestDate.slice(5) : null;
}

function deriveReportPriorPeriod(period: Period): Period | null {
  const year = Number(period.year);
  if (Number.isNaN(year)) return null;
  return { ...period, year: String(year - 1) };
}

function aggregateReportTotals(records: SundayMetric[]): ReportTotals {
  return records.reduce<ReportTotals>(
    (totals, record) => ({
      attendance: totals.attendance + record.attendance,
      volunteers: totals.volunteers + record.volunteers,
      firstTimeGuests: totals.firstTimeGuests + record.first_time_guests,
      salvations: totals.salvations + record.salvations,
      kids: totals.kids + record.kids,
      growthTrack: totals.growthTrack + record.growth_track,
      baptism: totals.baptism + record.baptism,
    }),
    { attendance: 0, volunteers: 0, firstTimeGuests: 0, salvations: 0, kids: 0, growthTrack: 0, baptism: 0 },
  );
}

function getRecentFourWeekTrend(records: SundayMetric[], field: keyof ReportTotals) {
  const byDate = new Map<string, number>();
  records.forEach((record) => {
    byDate.set(record.service_date, (byDate.get(record.service_date) ?? 0) + getRecordReportFieldValue(record, field));
  });

  const values = Array.from(byDate.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, value]) => value)
    .filter((value) => value > 0);

  if (values.length < 8) return null;

  const recent = values.slice(-4);
  const previous = values.slice(-8, -4);
  return pctChange(sumNumbers(recent), sumNumbers(previous));
}

function getRecordReportFieldValue(record: SundayMetric, field: keyof ReportTotals) {
  switch (field) {
    case "firstTimeGuests":
      return record.first_time_guests;
    case "growthTrack":
      return record.growth_track;
    default:
      return record[field];
  }
}

function pctChange(current: number, prior: number) {
  if (prior <= 0) return null;
  return Math.round(((current - prior) / prior) * 100);
}

function safeRatio(numerator: number, denominator: number) {
  if (denominator <= 0 || numerator <= 0) return null;
  return numerator / denominator;
}

function sumNumbers(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0);
}

function getToneForChange(value: number | null): ReportTone {
  if (value === null) return "neutral";
  if (value >= 5) return "positive";
  if (value <= -5) return "warning";
  return "neutral";
}

function MetaPill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-[#fbfbfc] px-3 py-1.5 text-xs font-medium text-slate-700">
      {icon}
      {label}
    </span>
  );
}

function ScorePill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "positive" | "warning" | "neutral";
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-[#fbfbfc] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">{label}</p>
      <div className="mt-3 flex items-center gap-2">
        {tone === "positive" ? (
          <TrendingUp className="h-4 w-4 text-emerald-600" />
        ) : tone === "warning" ? (
          <TrendingDown className="h-4 w-4 text-rose-600" />
        ) : (
          <LineChart className="h-4 w-4 text-slate-500" />
        )}
        <p className="text-lg font-semibold text-slate-950">{value}</p>
      </div>
    </div>
  );
}

function RatioPill({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-950">{value}</p>
      {note && <p className="mt-1 text-[11px] font-medium text-gray-500">{note}</p>}
    </div>
  );
}

function ReportMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function verdictPillClass(verdict: "Strong" | "Healthy" | "Watch" | "Critical") {
  return [
    "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
    verdict === "Strong"
      ? "bg-emerald-100 text-emerald-700"
      : verdict === "Healthy"
        ? "bg-sky-100 text-sky-700"
        : verdict === "Critical"
          ? "bg-rose-100 text-rose-700"
          : "bg-amber-100 text-amber-700",
  ].join(" ");
}

function formatSignedPercent(value: number | null, fallback = "N/A") {
  if (value === null || Number.isNaN(value)) return fallback;
  return `${value > 0 ? "+" : ""}${value}%`;
}

function formatDeltaPoints(value: number | null) {
  if (value === null || Number.isNaN(value)) return "N/A";
  return `${value > 0 ? "+" : ""}${value} pts`;
}

function formatRatioPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatRatioPercentOptional(value: number | null) {
  return value === null ? "N/A" : formatRatioPercent(value);
}

function formatDateLabel(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return formatCalendarDate(date);
}

function formatCalendarDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
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
