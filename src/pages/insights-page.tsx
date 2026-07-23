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
import type { ComparisonFilters } from "../lib/mock-data";
import { getBigEventOverview } from "../lib/big-events";
import {
  buildComparisonBrief,
  buildComparisonHtml,
  formatPeriodLong,
  getAvailableCampuses,
  getAvailableYears,
  getComparisonDatasetFromMetrics,
  getDashboardInsights,
  getEventNotes,
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
                  <RatioPill label="Volunteer coverage" value={formatRatioPercent(health.volunteerRatio)} />
                  <RatioPill label="Guest rate" value={formatRatioPercent(health.ftgRate)} />
                  <RatioPill label="Kids ratio" value={formatRatioPercent(health.kidsRatio)} />
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

function buildMeetingTalkingPoints(
  insights: ReturnType<typeof getDashboardInsights>,
  scopeLabel: string,
) {
  const points: string[] = [];

  if (insights.scorecard) {
    points.push(
      `${scopeLabel} is currently rated ${insights.scorecard.verdict.toLowerCase()}, with attendance ${formatSignedPercent(insights.scorecard.currentChange).toLowerCase()} versus the comparable prior window.`,
    );

    if (insights.scorecard.acceleration !== null) {
      points.push(
        insights.scorecard.acceleration >= 0
          ? `Growth speed is improving, which suggests the current trend has more underlying strength than a simple one-period spike.`
          : `Growth speed is slowing, which means topline growth should be pressure-tested before it is treated as durable momentum.`,
      );
    }
  }

  insights.findings.slice(0, 2).forEach((finding) => {
    points.push(`${finding.title}. ${finding.detail}`);
  });

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
      `${scopeLabel} is currently ${insights.scorecard.verdict.toLowerCase()}, with ${formatSignedPercent(insights.scorecard.currentChange).toLowerCase()} attendance versus the same point in the prior comparison window.`,
    );

    if (insights.scorecard.acceleration !== null) {
      summary.push(
        insights.scorecard.acceleration >= 0
          ? `Growth speed is improving, which is a stronger signal than topline growth alone and suggests the trend has operational support behind it.`
          : `Growth speed is slowing, which means current topline performance should be treated carefully until we see whether the slowdown is seasonal or structural.`,
      );
    }
  }

  if (insights.findings[0]) {
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

  if (weakestCoverage && weakestCoverage.volunteerRatio < 0.14) {
    flags.push({
      title: `${weakestCoverage.campus} is capacity-constrained`,
      detail: `Volunteer coverage is only ${formatRatioPercent(weakestCoverage.volunteerRatio)}. Further growth without staffing depth could create quality or retention pressure.`,
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

  insights.findings
    .filter((finding) => finding.tone === "warning")
    .slice(0, 2)
    .forEach((finding) => {
      items.push({
        label: "Priority finding",
        title: finding.title,
        detail: finding.detail,
        priority: "Now",
      });
    });

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

  if (weakestCoverage && weakestCoverage.volunteerRatio < 0.14) {
    items.push({
      label: "Capacity",
      title: `Pressure-test serving depth at ${weakestCoverage.campus}`,
      detail: `Volunteer coverage is ${formatRatioPercent(weakestCoverage.volunteerRatio)}. Leadership should confirm whether the campus can absorb further growth without service quality slipping.`,
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

function RatioPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-950">{value}</p>
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
