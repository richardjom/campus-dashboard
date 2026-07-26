import { AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarDays, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { churchGrowthBenchmarks, type DashboardInsights, type EventNote } from "../lib/sunday-metrics";

type InsightsPanelProps = {
  insights: DashboardInsights;
  events: EventNote[];
  variant?: "full" | "rail" | "wide";
};

export function InsightsPanel({ insights, events, variant = "full" }: InsightsPanelProps) {
  const { scorecard, executiveBrief, actionCards, findings, trendAlerts, anomalies, health, latestDate, metricLabel, scopedCampuses } = insights;
  const hasAnyData =
    !!scorecard || !!executiveBrief || actionCards.length > 0 || findings.length > 0 || trendAlerts.length > 0 || anomalies.length > 0 || health.length > 0 || events.length > 0;

  if (variant === "wide") {
    return (
      <div className="space-y-6">
        <OperatingAgendaCard cards={actionCards} layout="grid" />
        <PriorityFindingsCard findings={findings} />
      </div>
    );
  }

  if (variant === "rail") {
    return (
      <div className="space-y-6">
        <ExecutiveBriefCard brief={executiveBrief} metricLabel={metricLabel} scopedCampuses={scopedCampuses} />
        <GrowthScorecardCard scorecard={scorecard} />
        <TrendWatchCard alerts={trendAlerts} />
        <AnomalyCard anomalies={anomalies} events={events} />
        <EventsCard events={events} />
        <HealthRatiosCard health={health} latestDate={latestDate} />
        {!hasAnyData && (
          <div className="rounded-[30px] border border-gray-200 bg-white p-6 text-sm text-gray-500">
            Not enough data yet to surface insights. Import more weekly records to start seeing trend alerts and anomalies.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ExecutiveBriefCard brief={executiveBrief} metricLabel={metricLabel} scopedCampuses={scopedCampuses} />
      <OperatingAgendaCard cards={actionCards} />
      <GrowthScorecardCard scorecard={scorecard} />
      <PriorityFindingsCard findings={findings} />
      <TrendWatchCard alerts={trendAlerts} />
      <AnomalyCard anomalies={anomalies} events={events} />
      <EventsCard events={events} />
      <HealthRatiosCard health={health} latestDate={latestDate} />
      {!hasAnyData && (
        <div className="rounded-[30px] border border-gray-200 bg-white p-6 text-sm text-gray-500">
          Not enough data yet to surface insights. Import more weekly records to start seeing trend alerts and anomalies.
        </div>
      )}
    </div>
  );
}

function OperatingAgendaCard({ cards, layout = "stacked" }: { cards: DashboardInsights["actionCards"]; layout?: "stacked" | "grid" }) {
  if (cards.length === 0) return null;

  return (
    <section className="rounded-[30px] border border-gray-200 bg-white p-6 lg:p-7">
      <div className="flex items-start justify-between gap-3 border-b border-gray-200 pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Executive operating agenda</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">Decisions that move the work</h2>
          <p className="mt-2 text-xs leading-5 text-gray-500">Diagnosis, evidence, decision, action, and confirming data.</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fbfbfc] text-slate-700">
          <Sparkles className="h-4 w-4" />
        </div>
      </div>

      <div className={layout === "grid" ? "mt-4 grid gap-4 xl:grid-cols-2" : "mt-4 space-y-4"}>
        {cards.map((card) => (
          <div key={`${card.campus}-${card.lens}-${card.title}`} className="rounded-2xl border border-gray-200 bg-[#fbfbfc] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">{card.title}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">{card.lens}</p>
              </div>
              <span
                className={[
                  "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap",
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

            <p className="mt-3 text-sm leading-6 text-slate-700">{card.diagnosis}</p>

            <div className="mt-3 rounded-xl border border-gray-200 bg-white p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">Working theory</p>
              <p className="mt-1 text-sm leading-6 text-slate-800">{card.hypothesis}</p>
            </div>

            <div className="mt-3 rounded-xl border border-gray-200 bg-white p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">Decision</p>
              <p className="mt-1 text-sm leading-6 text-slate-800">{card.decision}</p>
            </div>

            <div className="mt-3 rounded-xl border border-gray-200 bg-white p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">Next move</p>
              <p className="mt-1 text-sm leading-6 text-slate-800">{card.nextMove}</p>
            </div>

            <div className="mt-3 space-y-2">
              {card.evidence.slice(0, 3).map((item) => (
                <p key={item} className="rounded-xl bg-white px-3 py-2 text-xs leading-5 text-gray-600">{item}</p>
              ))}
            </div>

            <div className="mt-3 rounded-xl border border-dashed border-gray-200 bg-white p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">Data to confirm</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {card.dataToConfirm.slice(0, 4).map((item) => (
                  <span key={item} className="rounded-full bg-[#fbfbfc] px-2.5 py-1 text-[11px] font-medium text-slate-600">
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

function GrowthScorecardCard({ scorecard }: { scorecard: DashboardInsights["scorecard"] }) {
  if (!scorecard) return null;

  return (
    <section className="rounded-[30px] border border-gray-200 bg-white p-6 lg:p-7">
      <div className="flex items-start justify-between gap-3 border-b border-gray-200 pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Growth framework</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">Executive scorecard</h2>
        </div>
        <span
          className={[
            "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
            scorecard.verdict === "Strong"
              ? "bg-emerald-100 text-emerald-700"
              : scorecard.verdict === "Healthy"
                ? "bg-sky-100 text-sky-700"
                : scorecard.verdict === "Critical"
                  ? "bg-rose-100 text-rose-700"
                  : "bg-amber-100 text-amber-700",
          ].join(" ")}
        >
          {scorecard.verdict}
        </span>
      </div>

      <p className="mt-5 text-sm leading-7 text-slate-700">{scorecard.summary}</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <ScorePill label="Current growth" value={`${scorecard.currentChange > 0 ? "+" : ""}${scorecard.currentChange}%`} tone={scorecard.currentChange >= 0 ? "positive" : "warning"} />
        <ScorePill
          label="Growth speed"
          value={scorecard.acceleration === null ? "N/A" : `${scorecard.acceleration > 0 ? "+" : ""}${scorecard.acceleration} pts`}
          tone={scorecard.acceleration === null ? "neutral" : scorecard.acceleration >= 0 ? "positive" : "warning"}
        />
        <ScorePill
          label="Seasonal baseline"
          value={scorecard.seasonalDelta === null ? "Limited history" : `${scorecard.seasonalDelta > 0 ? "+" : ""}${scorecard.seasonalDelta}%`}
          tone={scorecard.seasonalDelta === null ? "neutral" : scorecard.seasonalDelta >= 0 ? "positive" : "warning"}
        />
      </div>

      <div className="mt-4 space-y-3">
        {scorecard.campuses.map((campus) => (
          <div key={campus.campus} className="rounded-2xl border border-gray-200 bg-[#fbfbfc] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">{campus.campus}</p>
                <p className="mt-1 text-xs text-gray-500">{campus.lifecycle}</p>
              </div>
              <span
                className={[
                  "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap",
                  campus.verdict === "Strong"
                    ? "bg-emerald-100 text-emerald-700"
                    : campus.verdict === "Healthy"
                      ? "bg-sky-100 text-sky-700"
                      : campus.verdict === "Critical"
                        ? "bg-rose-100 text-rose-700"
                        : "bg-amber-100 text-amber-700",
                ].join(" ")}
              >
                {campus.verdict}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
              <span>{campus.currentChange > 0 ? "+" : ""}{campus.currentChange}% current</span>
              <span>{campus.acceleration === null ? "speed n/a" : `${campus.acceleration > 0 ? "+" : ""}${campus.acceleration} pts speed`}</span>
              <span>{campus.seasonalDelta === null ? "seasonality n/a" : `${campus.seasonalDelta > 0 ? "+" : ""}${campus.seasonalDelta}% seasonal`}</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-700">{campus.reason}</p>
          </div>
        ))}
      </div>

      {scorecard.transitions.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-gray-200 bg-[#fbfbfc] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">Leadership transitions</p>
          <div className="mt-3 space-y-2">
            {scorecard.transitions.map((event) => (
              <div key={`${event.campus}-${event.date}-${event.note}`} className="flex items-center justify-between gap-3 text-sm text-slate-700">
                <span>{event.campus} · {event.type}</span>
                <span className="text-xs text-gray-500">{event.timing} · {formatShortDate(event.date)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-gray-200 bg-[#fbfbfc] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">Leadership transitions</p>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            No campus pastor or staff transitions are logged for this scope yet. Adding those events will make the growth read more explainable.
          </p>
        </div>
      )}

      {scorecard.dataCaveat && (
        <p className="mt-4 text-xs leading-6 text-gray-500">{scorecard.dataCaveat}</p>
      )}
    </section>
  );
}

function ExecutiveBriefCard({
  brief,
  metricLabel,
  scopedCampuses,
}: {
  brief: DashboardInsights["executiveBrief"];
  metricLabel: string;
  scopedCampuses: string[];
}) {
  if (!brief) return null;

  return (
    <section className="rounded-[30px] border border-gray-200 bg-white p-6 lg:p-7">
      <div className="flex items-start justify-between gap-3 border-b border-gray-200 pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Executive brief</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">{brief.headline}</h2>
          <p className="mt-2 text-xs text-gray-500">
            Scope: {scopedCampuses.join(", ")} · Metric: {metricLabel}
          </p>
        </div>
        <span
          className={[
            "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
            brief.tone === "positive"
              ? "bg-emerald-100 text-emerald-700"
              : brief.tone === "warning"
                ? "bg-rose-100 text-rose-700"
                : "bg-slate-100 text-slate-700",
          ].join(" ")}
        >
          {brief.tone === "positive" ? "Positive" : brief.tone === "warning" ? "Needs attention" : "Stable"}
        </span>
      </div>

      <p className="mt-5 text-sm leading-7 text-slate-700">{brief.summary}</p>
    </section>
  );
}

function PriorityFindingsCard({ findings }: { findings: DashboardInsights["findings"] }) {
  if (findings.length === 0) return null;

  return (
    <section className="rounded-[30px] border border-gray-200 bg-white p-6 lg:p-7">
      <div className="flex items-start justify-between gap-3 border-b border-gray-200 pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Priority findings</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">What leadership should focus on</h2>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fbfbfc] text-slate-700">
          <Sparkles className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {findings.map((finding) => (
          <div key={finding.title} className="rounded-2xl border border-gray-200 bg-[#fbfbfc] p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-slate-950">{finding.title}</p>
              <span
                className={[
                  "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap",
                  finding.tone === "positive"
                    ? "bg-emerald-100 text-emerald-700"
                    : finding.tone === "warning"
                      ? "bg-rose-100 text-rose-700"
                      : "bg-slate-100 text-slate-700",
                ].join(" ")}
              >
                {finding.lens}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-700">{finding.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function EventsCard({ events }: { events: EventNote[] }) {
  if (events.length === 0) return null;
  // Show the 6 most recent events
  const recent = [...events].reverse().slice(0, 6);

  return (
    <section className="rounded-[30px] border border-gray-200 bg-white p-6 lg:p-7">
      <div className="flex items-start justify-between gap-3 border-b border-gray-200 pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Calendar context</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">Notable Sundays</h2>
          <p className="mt-2 text-xs text-gray-500">Special services, weather, and events that explain unusual swings.</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fbfbfc] text-slate-700">
          <CalendarDays className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {recent.map((event) => (
          <div key={event.date} className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-[#fbfbfc] px-3 py-2.5">
            <p className="text-sm text-slate-700">{event.note}</p>
            <p className="text-xs font-semibold text-gray-500 whitespace-nowrap">{formatShortDate(event.date)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function TrendWatchCard({ alerts }: { alerts: DashboardInsights["trendAlerts"] }) {
  const declining = alerts.filter((a) => a.direction === "down");
  const accelerating = alerts.filter((a) => a.direction === "up");

  return (
    <section className="rounded-[30px] border border-gray-200 bg-white p-6 lg:p-7">
      <div className="flex items-start justify-between gap-3 border-b border-gray-200 pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Trend watch</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">Recent vs. baseline</h2>
          <p className="mt-2 text-xs text-gray-500">Last 4 weeks compared to previous 4 weeks</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fbfbfc] text-slate-700">
          <Sparkles className="h-4 w-4" />
        </div>
      </div>

      {alerts.length === 0 ? (
        <p className="mt-5 text-sm text-gray-500">No significant trend shifts detected. All campuses tracking within ±8% of their recent baseline.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {declining.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-rose-600">Needs attention</p>
              {declining.map((alert) => (
                <TrendRow key={`${alert.campus}-${alert.metricLabel}`} alert={alert} />
              ))}
            </div>
          )}
          {accelerating.length > 0 && (
            <div className={declining.length > 0 ? "pt-2" : ""}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Picking up</p>
              {accelerating.map((alert) => (
                <TrendRow key={`${alert.campus}-${alert.metricLabel}`} alert={alert} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
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
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">{label}</p>
      <p
        className={[
          "mt-2 text-lg font-semibold tracking-[-0.03em]",
          tone === "positive" ? "text-emerald-700" : tone === "warning" ? "text-rose-700" : "text-slate-900",
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  );
}

function TrendRow({ alert }: { alert: DashboardInsights["trendAlerts"][number] }) {
  const isDown = alert.direction === "down";
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-[#fbfbfc] px-3 py-2.5 last:mb-0 [&:not(:last-child)]:mb-2">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-950">{alert.campus}</p>
        <p className="text-xs text-gray-500">
          {alert.metricLabel} · {alert.recentAvg.toLocaleString()} vs {alert.baselineAvg.toLocaleString()}
        </p>
      </div>
      <span
        className={[
          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
          isDown ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700",
        ].join(" ")}
      >
        {isDown ? <ArrowDownRight className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
        {alert.pctChange > 0 ? "+" : ""}
        {alert.pctChange}%
      </span>
    </div>
  );
}

function AnomalyCard({ anomalies, events }: { anomalies: DashboardInsights["anomalies"]; events: EventNote[] }) {
  const eventByDate = new Map(events.map((e) => [e.date, e.note]));
  return (
    <section className="rounded-[30px] border border-gray-200 bg-white p-6 lg:p-7">
      <div className="flex items-start justify-between gap-3 border-b border-gray-200 pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Anomalies</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">Weeks that stood out</h2>
          <p className="mt-2 text-xs text-gray-500">Single Sundays that deviated 20%+ from their 4-week local average</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fbfbfc] text-slate-700">
          <AlertTriangle className="h-4 w-4" />
        </div>
      </div>

      {anomalies.length === 0 ? (
        <p className="mt-5 text-sm text-gray-500">No recent anomalies detected. Recent Sundays are tracking close to their rolling averages.</p>
      ) : (
        <div className="mt-4 space-y-2">
          {anomalies.map((anomaly) => {
            const isDrop = anomaly.direction === "drop";
            const eventNote = eventByDate.get(anomaly.date);
            return (
              <div
                key={`${anomaly.campus}-${anomaly.date}`}
                className="flex items-start justify-between gap-3 rounded-2xl border border-gray-200 bg-[#fbfbfc] px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-950">
                    {anomaly.campus} <span className="font-normal text-gray-500">— {formatShortDate(anomaly.date)}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    {anomaly.value.toLocaleString()} vs expected {anomaly.expected.toLocaleString()}
                  </p>
                  {eventNote && (
                    <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                      <CalendarDays className="h-2.5 w-2.5" />
                      {eventNote}
                    </p>
                  )}
                </div>
                <span
                  className={[
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
                    isDrop ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700",
                  ].join(" ")}
                >
                  {isDrop ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
                  {anomaly.deviationPct > 0 ? "+" : ""}
                  {anomaly.deviationPct}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function HealthRatiosCard({ health, latestDate }: { health: DashboardInsights["health"]; latestDate: string | null }) {
  if (health.length === 0) {
    return null;
  }

  return (
    <section className="rounded-[30px] border border-gray-200 bg-white p-6 lg:p-7">
      <div className="border-b border-gray-200 pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Health ratios</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">Latest Sunday</h2>
        {latestDate && (
          <p className="mt-2 text-xs text-gray-500">Service of {formatShortDate(latestDate)}</p>
        )}
      </div>

      <div className="mt-4 space-y-2">
        {health.map((row) => (
          <div key={row.campus} className="rounded-2xl border border-gray-200 bg-[#fbfbfc] p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-950">{row.campus}</p>
              <p className="text-xs text-gray-500">{row.attendance.toLocaleString()} att.</p>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <RatioStat
                label="Volunteer"
                value={row.volunteerRatio}
                target={`Healthy ${formatRatioPercent(churchGrowthBenchmarks.weeklyVolunteerCoverageHealthy)}+`}
                status={row.volunteerStatus}
              />
              <RatioStat
                label="Kids"
                value={row.kidsRatio}
                target={`${formatRatioPercent(churchGrowthBenchmarks.kidsRatioMin)}-${formatRatioPercent(churchGrowthBenchmarks.kidsRatioMax)}`}
                status={row.kidsStatus}
              />
              <RatioStat
                label="First-time"
                value={row.ftgRate}
                target={`${formatRatioPercent(churchGrowthBenchmarks.firstTimeGuestRateMin)}-${formatRatioPercent(churchGrowthBenchmarks.firstTimeGuestRateMax)}`}
                status={row.ftgStatus}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RatioStat({
  label,
  value,
  target,
  status,
}: {
  label: string;
  value: number;
  target: string;
  status: "Strong" | "Healthy" | "Watch" | "Strained";
}) {
  const pct = (value * 100).toFixed(1);
  const tone =
    status === "Strong" || status === "Healthy"
      ? "text-emerald-700"
      : status === "Strained"
        ? "text-rose-600"
        : "text-amber-700";
  return (
    <div className="rounded-xl bg-white px-2 py-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400">{label}</p>
      <p className={["mt-0.5 text-sm font-semibold", tone].join(" ")}>{pct}%</p>
      <p className="mt-0.5 text-[10px] font-medium text-gray-400">{target}</p>
    </div>
  );
}

function formatRatioPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatShortDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${iso}T00:00:00`));
}
