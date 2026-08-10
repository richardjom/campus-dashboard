import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Baby,
  CalendarDays,
  Car,
  MessageSquare,
  Save,
  SlidersHorizontal,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import type { BigEventRecord } from "../lib/big-events";
import { hasMetricField, type SundayMetric } from "../lib/sunday-metrics";

type BigFiveEventName = "Relationship Series" | "Easter" | "Welcome Home" | "At The Movies" | "Christmas";

type BigFivePlanningEvent = {
  eventName: BigFiveEventName;
  eventDate: string;
  priorDate: string;
  defaultLiftPct: number;
  description: string;
};

type PlanningHistoryRow = {
  eventName: BigFiveEventName;
  campus: string;
  date: string;
  actualAttendance: number | null;
  priorForecast: number | null;
  assumptions: string;
};

type StoredPlanningHistoryPayload = {
  updatedAt: string;
  rows: PlanningHistoryRow[];
};

type ForecastResult = {
  campus: string;
  eventName: BigFiveEventName;
  eventDate: string;
  priorDate: string;
  priorEventActual: number | null;
  priorJanAugAverage: number | null;
  currentJanAugAverage: number | null;
  janAugGrowthPct: number | null;
  recentWeeklyAverage: number | null;
  recentMomentumPct: number | null;
  eventLiftPct: number;
  low: number | null;
  likely: number | null;
  high: number | null;
  planningNumber: number | null;
  confidence: "High" | "Medium" | "Directional";
  confidenceBandPct: number;
  volunteersNeeded: number | null;
  kidsExpected: number | null;
  parkingSpaces: number | null;
  seatingTarget: number | null;
  answerable: boolean;
  historyRows: PlanningHistoryRow[];
};

const bigFivePlanningEvents: BigFivePlanningEvent[] = [
  {
    eventName: "Relationship Series",
    eventDate: "2026-02-08",
    priorDate: "2025-02-09",
    defaultLiftPct: 3,
    description: "February relationship series planning window.",
  },
  {
    eventName: "Easter",
    eventDate: "2026-04-05",
    priorDate: "2025-04-20",
    defaultLiftPct: 8,
    description: "High-invite Easter weekend planning anchor.",
  },
  {
    eventName: "Welcome Home",
    eventDate: "2026-09-13",
    priorDate: "2025-09-14",
    defaultLiftPct: 4,
    description: "Fall launch and second-Sunday September Welcome Home push.",
  },
  {
    eventName: "At The Movies",
    eventDate: "2026-10-11",
    priorDate: "2025-10-12",
    defaultLiftPct: 6,
    description: "October attractional series planning window.",
  },
  {
    eventName: "Christmas",
    eventDate: "2026-12-20",
    priorDate: "2025-12-21",
    defaultLiftPct: 10,
    description: "Christmas service planning anchor.",
  },
];

const seededPlanningHistory: PlanningHistoryRow[] = [
  {
    eventName: "Welcome Home",
    campus: "BWI",
    date: "2025-09-14",
    actualAttendance: 5044,
    priorForecast: null,
    assumptions: "User-provided prior actual for BWI Welcome Home 2025.",
  },
];

const planningHistoryStorageKey = "church-dashboard-event-planning-history";

function readPlanningHistoryRows() {
  if (typeof window === "undefined") {
    return seededPlanningHistory;
  }

  const rawValue = window.localStorage.getItem(planningHistoryStorageKey);

  if (!rawValue) {
    return seededPlanningHistory;
  }

  try {
    const payload = JSON.parse(rawValue) as StoredPlanningHistoryPayload;
    const storedRows = Array.isArray(payload.rows) ? payload.rows.filter(isPlanningHistoryRow) : [];
    return mergePlanningHistoryRows([...seededPlanningHistory, ...storedRows]);
  } catch {
    return seededPlanningHistory;
  }
}

function writePlanningHistoryRows(rows: PlanningHistoryRow[]) {
  if (typeof window === "undefined") {
    return;
  }

  const payload: StoredPlanningHistoryPayload = {
    updatedAt: new Date().toISOString(),
    rows: mergePlanningHistoryRows(rows),
  };

  window.localStorage.setItem(planningHistoryStorageKey, JSON.stringify(payload));
}

function upsertPlanningHistoryRow(rows: PlanningHistoryRow[], row: PlanningHistoryRow) {
  return mergePlanningHistoryRows([...rows, row]);
}

function mergePlanningHistoryRows(rows: PlanningHistoryRow[]) {
  const merged = new Map<string, PlanningHistoryRow>();

  rows.forEach((row) => {
    merged.set(getPlanningHistoryKey(row), row);
  });

  return Array.from(merged.values()).sort((left, right) => {
    if (left.date !== right.date) return left.date.localeCompare(right.date);
    if (left.campus !== right.campus) return left.campus.localeCompare(right.campus);
    return left.eventName.localeCompare(right.eventName);
  });
}

function getPlanningHistoryKey(row: PlanningHistoryRow) {
  return `${row.eventName}|${row.campus}|${row.date}`;
}

function isPlanningHistoryRow(candidate: unknown): candidate is PlanningHistoryRow {
  if (!candidate || typeof candidate !== "object") {
    return false;
  }

  const row = candidate as PlanningHistoryRow;
  return (
    bigFivePlanningEvents.some((event) => event.eventName === row.eventName) &&
    typeof row.campus === "string" &&
    typeof row.date === "string" &&
    (row.actualAttendance === null || typeof row.actualAttendance === "number") &&
    (row.priorForecast === null || typeof row.priorForecast === "number") &&
    typeof row.assumptions === "string"
  );
}

const sampleQuestions = [
  "What is the likely BWI projection for Welcome Home 2026?",
  "How much is BWI up year over year?",
  "What should we staff for on September 13?",
  "Can BWI hit 5,500?",
  "What was last year's actual for Welcome Home?",
];

export function EventForecastPlanner({
  metrics,
  eventRecords,
  campusOptions,
}: {
  metrics: SundayMetric[];
  eventRecords: BigEventRecord[];
  campusOptions: string[];
}) {
  const availableCampuses = campusOptions.length > 0 ? campusOptions : Array.from(new Set(metrics.map((metric) => metric.campus))).sort();
  const [campus, setCampus] = useState(() => (availableCampuses.includes("BWI") ? "BWI" : availableCampuses[0] ?? "BWI"));
  const [eventName, setEventName] = useState<BigFiveEventName>("Welcome Home");
  const selectedEvent = bigFivePlanningEvents.find((event) => event.eventName === eventName) ?? bigFivePlanningEvents[2];
  const [eventLiftPct, setEventLiftPct] = useState(selectedEvent.defaultLiftPct);
  const [question, setQuestion] = useState(sampleQuestions[0]);
  const [planningHistory, setPlanningHistory] = useState<PlanningHistoryRow[]>(() => readPlanningHistoryRows());
  const [priorActualInput, setPriorActualInput] = useState("");
  const [historyMessage, setHistoryMessage] = useState("");

  useEffect(() => {
    if (!availableCampuses.includes(campus) && availableCampuses.length > 0) {
      setCampus(availableCampuses.includes("BWI") ? "BWI" : availableCampuses[0]);
    }
  }, [availableCampuses, campus]);

  useEffect(() => {
    setEventLiftPct(selectedEvent.defaultLiftPct);
  }, [selectedEvent.defaultLiftPct, eventName]);

  const forecast = useMemo(
    () => buildForecast(metrics, eventRecords, planningHistory, campus, selectedEvent, eventLiftPct),
    [campus, eventLiftPct, eventRecords, metrics, planningHistory, selectedEvent],
  );
  const answer = useMemo(() => answerForecastQuestion(question, forecast), [forecast, question]);

  useEffect(() => {
    setPriorActualInput(forecast.priorEventActual === null ? "" : String(forecast.priorEventActual));
    setHistoryMessage("");
  }, [campus, eventName, forecast.priorEventActual]);

  const savePriorActual = () => {
    const parsed = Number(priorActualInput.replace(/,/g, ""));

    if (!Number.isFinite(parsed) || parsed <= 0) {
      setHistoryMessage("Enter a valid prior event attendance number before saving.");
      return;
    }

    const row: PlanningHistoryRow = {
      eventName,
      campus,
      date: selectedEvent.priorDate,
      actualAttendance: Math.round(parsed),
      priorForecast: null,
      assumptions: "Manual prior-year event actual entered in the dashboard forecast planner.",
    };
    const nextHistory = upsertPlanningHistoryRow(planningHistory, row);
    setPlanningHistory(nextHistory);
    writePlanningHistoryRows(nextHistory);
    setHistoryMessage(`Saved ${campus} ${eventName} ${selectedEvent.priorDate} actual at ${Math.round(parsed).toLocaleString()}.`);
  };

  return (
    <section className="rounded-[30px] border border-gray-200 bg-white p-6 lg:p-7">
      <div className="flex flex-col gap-5 border-b border-gray-200 pb-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Planning forecast</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.06em] text-slate-950">
            Big Five event forecast
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-700">
            Use live campus attendance trends to turn major Sundays into staffing, seating, parking, kids, and guest
            experience planning numbers.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <label className="flex min-w-[180px] flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Campus</span>
            <select
              value={campus}
              onChange={(event) => setCampus(event.target.value)}
              className="h-12 rounded-2xl border border-gray-200 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-[#2563eb]"
            >
              {availableCampuses.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="flex min-w-[220px] flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Event</span>
            <select
              value={eventName}
              onChange={(event) => setEventName(event.target.value as BigFiveEventName)}
              className="h-12 rounded-2xl border border-gray-200 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-[#2563eb]"
            >
              {bigFivePlanningEvents.map((event) => (
                <option key={event.eventName} value={event.eventName}>
                  {event.eventName}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
        <div className="space-y-5">
          <div className="rounded-[28px] border border-gray-200 bg-[#fbfbfc] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#2563eb]">
                    <CalendarDays className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                      {forecast.eventDate}
                    </p>
                    <h3 className="mt-1 text-2xl font-semibold tracking-[-0.05em] text-slate-950">
                      {forecast.campus} {forecast.eventName} forecast
                    </h3>
                  </div>
                </div>
                <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-700">{selectedEvent.description}</p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Planning number</p>
                <p className="mt-2 text-4xl font-semibold tracking-[-0.06em] text-slate-950">
                  {formatNumber(forecast.planningNumber)}
                </p>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  Staff to this number for guest experience, not just the likely midpoint.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <ForecastScenario label="Low" value={forecast.low} detail={`${forecast.confidenceBandPct}% downside band`} />
              <ForecastScenario label="Likely" value={forecast.likely} detail={`${formatSignedPercent(forecast.eventLiftPct)} event-lift assumption`} featured />
              <ForecastScenario label="High" value={forecast.high} detail={`${forecast.confidenceBandPct}% upside band`} />
            </div>

            <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Event lift assumption</p>
                  <p className="mt-1 text-sm leading-6 text-slate-700">
                    Adjust the extra lift above current trend for marketing, series energy, invites, and weekend execution.
                  </p>
                </div>
                <span className="inline-flex rounded-full bg-[#eff6ff] px-3 py-1 text-xs font-semibold text-[#2563eb]">
                  {formatSignedPercent(eventLiftPct)}
                </span>
              </div>

              <div className="mt-4 flex items-center gap-4">
                <SlidersHorizontal className="h-4 w-4 text-gray-500" />
                <input
                  type="range"
                  min="-10"
                  max="20"
                  step="1"
                  value={eventLiftPct}
                  onChange={(event) => setEventLiftPct(Number(event.target.value))}
                  className="w-full accent-[#2563eb]"
                />
              </div>
              <div className="mt-2 flex justify-between text-[11px] font-medium text-gray-500">
                <span>-10%</span>
                <span>Trend only</span>
                <span>+20%</span>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Prior event actual</p>
                <p className="mt-1 text-sm leading-6 text-slate-700">
                  Add the prior-year actual for any campus to anchor its forecast.
                </p>
                <div className="mt-4 flex gap-2">
                  <input
                    type="number"
                    min="0"
                    value={priorActualInput}
                    onChange={(event) => setPriorActualInput(event.target.value)}
                    className="h-12 min-w-0 flex-1 rounded-2xl border border-gray-200 bg-[#fbfbfc] px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-[#2563eb]"
                    placeholder="5044"
                  />
                  <button
                    type="button"
                    onClick={savePriorActual}
                    className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[#111827] px-4 text-sm font-semibold text-white transition hover:bg-black"
                  >
                    <Save className="h-4 w-4" />
                    Save
                  </button>
                </div>
                {historyMessage && <p className="mt-3 text-xs leading-5 text-slate-600">{historyMessage}</p>}
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">How it is forecasted</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Likely forecast = prior event actual x Jan-Aug YoY growth x event-lift assumption. Low/high use
                  recent Jan-Aug attendance volatility, clamped to a {forecast.confidenceBandPct}% band. Planning number
                  uses the likely forecast plus part of the upside so operations prepare above the midpoint.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <PlanningMetric
              icon={<Target className="h-4 w-4" />}
              label="Prior event actual"
              value={formatNumber(forecast.priorEventActual)}
              note={`${forecast.priorDate} actual`}
            />
            <PlanningMetric
              icon={<TrendingUp className="h-4 w-4" />}
              label="Jan-Aug YoY avg"
              value={formatSignedPercent(forecast.janAugGrowthPct, "Need 2025/2026")}
              note={`${formatNumber(forecast.priorJanAugAverage)} to ${formatNumber(forecast.currentJanAugAverage)}`}
            />
            <PlanningMetric
              icon={<Users className="h-4 w-4" />}
              label="Recent weekly avg"
              value={formatNumber(forecast.recentWeeklyAverage)}
              note={forecast.recentMomentumPct === null ? "Need more weeks" : `${formatSignedPercent(forecast.recentMomentumPct)} vs prior 4 weeks`}
            />
            <PlanningMetric
              icon={<MessageSquare className="h-4 w-4" />}
              label="Confidence"
              value={forecast.confidence}
              note={`${forecast.confidenceBandPct}% forecast band`}
            />
          </div>

          <div className="rounded-[28px] border border-gray-200 bg-[#fbfbfc] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Operational staffing read</p>
                <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-slate-950">What to prepare for</h3>
              </div>
              <span className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                Based on {formatNumber(forecast.planningNumber)}
              </span>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <PlanningMetric icon={<Users className="h-4 w-4" />} label="Volunteers" value={formatNumber(forecast.volunteersNeeded)} note="16% coverage target" />
              <PlanningMetric icon={<Baby className="h-4 w-4" />} label="Kids" value={formatNumber(forecast.kidsExpected)} note="Uses current kids ratio" />
              <PlanningMetric icon={<Car className="h-4 w-4" />} label="Parking" value={formatNumber(forecast.parkingSpaces)} note="2.3 people per car" />
              <PlanningMetric icon={<Target className="h-4 w-4" />} label="Seating" value={formatNumber(forecast.seatingTarget)} note="Total seats across services" />
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[28px] border border-gray-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Ask the forecast</p>
            <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-slate-950">Plain-language planning questions</h3>

            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              className="mt-4 min-h-24 w-full resize-none rounded-2xl border border-gray-200 bg-[#fbfbfc] px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-[#2563eb]"
              placeholder="Ask about projections, staffing, YoY growth, prior actuals, or whether BWI can hit 5,500."
            />

            <div className="mt-3 flex flex-wrap gap-2">
              {sampleQuestions.map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => setQuestion(sample)}
                  className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-gray-50"
                >
                  {sample}
                </button>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-gray-200 bg-[#fbfbfc] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Answer</p>
              <p className="mt-2 text-sm leading-7 text-slate-800">{answer}</p>
            </div>
          </div>

          <div className="rounded-[28px] border border-gray-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Event history table</p>
            <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-slate-950">Actuals, forecasts, assumptions</h3>

            <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-200">
              <table className="min-w-[760px] text-left">
                <thead className="bg-[#fbfbfc]">
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Event</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Date</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Campus</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Actual</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Forecast</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Assumptions</th>
                  </tr>
                </thead>
                <tbody>
                  {forecast.historyRows.map((row) => (
                    <tr key={`${row.eventName}-${row.campus}-${row.date}`} className="border-b border-gray-100 last:border-b-0">
                      <td className="px-4 py-3 text-sm font-semibold text-slate-950">{row.eventName}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{row.date}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{row.campus}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{formatNumber(row.actualAttendance)}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{formatNumber(row.priorForecast)}</td>
                      <td className="px-4 py-3 text-xs leading-5 text-gray-600">{row.assumptions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-3 text-xs leading-5 text-gray-500">
              Next backend step: persist these rows in PostgreSQL with event name, date, campus, actual attendance,
              prior forecast, and planning assumptions.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function buildForecast(
  metrics: SundayMetric[],
  eventRecords: BigEventRecord[],
  planningHistory: PlanningHistoryRow[],
  campus: string,
  event: BigFivePlanningEvent,
  eventLiftPct: number,
): ForecastResult {
  const currentYear = event.eventDate.slice(0, 4);
  const priorYear = String(Number(currentYear) - 1);
  const priorEventActual = getPriorEventActual(campus, event.eventName, priorYear, eventRecords, planningHistory);
  const priorJanAug = getCampusAttendanceWindow(metrics, campus, priorYear, 1, 8);
  const currentJanAug = getCampusAttendanceWindow(metrics, campus, currentYear, 1, 8);
  const janAugGrowthPct = percentChangeNullable(currentJanAug.average, priorJanAug.average);
  const recentTrend = getRecentAttendanceTrend(metrics, campus, currentYear);
  const kidsRatio = getCurrentKidsRatio(metrics, campus, currentYear);
  const trendFactor = janAugGrowthPct === null ? 1 : 1 + janAugGrowthPct / 100;
  const anchor = priorEventActual ?? currentJanAug.average ?? recentTrend.recentAverage;
  const likely = anchor === null ? null : roundToNearest(anchor * trendFactor * (1 + eventLiftPct / 100), 25);
  const volatilityPct = currentJanAug.values.length >= 4 ? getVolatilityPercent(currentJanAug.values) : 8;
  const confidenceBandPct = clamp(Math.round(volatilityPct), 5, 14);
  const low = likely === null ? null : roundToNearest(likely * (1 - confidenceBandPct / 100), 25);
  const high = likely === null ? null : roundToNearest(likely * (1 + confidenceBandPct / 100), 25);
  const planningNumber = likely === null || high === null ? null : roundToNearest(likely + (high - likely) * 0.45, 25);
  const confidence: ForecastResult["confidence"] =
    priorEventActual !== null && priorJanAug.average !== null && currentJanAug.average !== null && currentJanAug.values.length >= 8
      ? "High"
      : priorEventActual !== null && (currentJanAug.average !== null || recentTrend.recentAverage !== null)
        ? "Medium"
        : "Directional";
  const historyRows = buildPlanningHistoryRows(campus, event, planningHistory, priorEventActual, likely, janAugGrowthPct, eventLiftPct);

  return {
    campus,
    eventName: event.eventName,
    eventDate: event.eventDate,
    priorDate: event.priorDate,
    priorEventActual,
    priorJanAugAverage: priorJanAug.average,
    currentJanAugAverage: currentJanAug.average,
    janAugGrowthPct,
    recentWeeklyAverage: recentTrend.recentAverage,
    recentMomentumPct: recentTrend.momentumPct,
    eventLiftPct,
    low,
    likely,
    high,
    planningNumber,
    confidence,
    confidenceBandPct,
    volunteersNeeded: planningNumber === null ? null : Math.ceil(planningNumber * 0.16),
    kidsExpected: planningNumber === null ? null : Math.ceil(planningNumber * kidsRatio),
    parkingSpaces: planningNumber === null ? null : Math.ceil(planningNumber / 2.3),
    seatingTarget: planningNumber,
    answerable: likely !== null,
    historyRows,
  };
}

function getPriorEventActual(
  campus: string,
  eventName: BigFiveEventName,
  priorYear: string,
  eventRecords: BigEventRecord[],
  planningHistory: PlanningHistoryRow[],
) {
  const saved = planningHistory.find(
    (row) => row.campus === campus && row.eventName === eventName && row.date.startsWith(priorYear),
  );

  if (saved?.actualAttendance) {
    return saved.actualAttendance;
  }

  if (campus !== "Network") {
    return null;
  }

  const importedTotal = eventRecords.find(
    (record) => record.year === priorYear && normalizeEventName(record.event) === normalizeEventName(eventName) && record.isTotal,
  );

  return importedTotal?.attendance ?? null;
}

function buildPlanningHistoryRows(
  campus: string,
  event: BigFivePlanningEvent,
  planningHistory: PlanningHistoryRow[],
  priorEventActual: number | null,
  likelyForecast: number | null,
  janAugGrowthPct: number | null,
  eventLiftPct: number,
): PlanningHistoryRow[] {
  const savedRows = planningHistory.filter((row) => row.campus === campus && row.eventName === event.eventName);
  const currentRow: PlanningHistoryRow = {
    eventName: event.eventName,
    campus,
    date: event.eventDate,
    actualAttendance: null,
    priorForecast: likelyForecast,
    assumptions:
      priorEventActual === null
        ? `Forecast needs prior event actual for ${campus}. Currently using available current trend only.`
        : `Forecast uses prior actual ${priorEventActual.toLocaleString()}, Jan-Aug YoY trend ${formatSignedPercent(janAugGrowthPct, "N/A")}, and ${formatSignedPercent(eventLiftPct)} event lift.`,
  };

  return [...savedRows, currentRow];
}

function getCampusAttendanceWindow(
  metrics: SundayMetric[],
  campus: string,
  year: string,
  startMonth: number,
  endMonth: number,
) {
  const totals = getCampusDailyAttendance(metrics, campus)
    .filter((entry) => {
      const month = Number(entry.date.slice(5, 7));
      return entry.date.startsWith(`${year}-`) && month >= startMonth && month <= endMonth && entry.attendance > 0;
    })
    .map((entry) => entry.attendance);

  return {
    values: totals,
    average: totals.length > 0 ? totals.reduce((sum, value) => sum + value, 0) / totals.length : null,
  };
}

function getRecentAttendanceTrend(metrics: SundayMetric[], campus: string, year: string) {
  const values = getCampusDailyAttendance(metrics, campus)
    .filter((entry) => entry.date.startsWith(`${year}-`) && entry.attendance > 0)
    .sort((left, right) => left.date.localeCompare(right.date));
  const recent = values.slice(-4).map((entry) => entry.attendance);
  const previous = values.slice(-8, -4).map((entry) => entry.attendance);
  const recentAverage = recent.length > 0 ? recent.reduce((sum, value) => sum + value, 0) / recent.length : null;
  const previousAverage = previous.length > 0 ? previous.reduce((sum, value) => sum + value, 0) / previous.length : null;

  return {
    recentAverage,
    momentumPct: percentChangeNullable(recentAverage, previousAverage),
  };
}

function getCurrentKidsRatio(metrics: SundayMetric[], campus: string, year: string) {
  const rows = metrics.filter(
    (metric) => metric.campus === campus && metric.service_date.startsWith(`${year}-`) && hasMetricField(metric, "attendance") && metric.attendance > 0,
  );
  const attendance = rows.reduce((sum, metric) => sum + metric.attendance, 0);
  const kids = rows.reduce((sum, metric) => (hasMetricField(metric, "kids") ? sum + metric.kids : sum), 0);
  if (attendance <= 0 || kids <= 0) return 0.22;
  return clamp(kids / attendance, 0.16, 0.3);
}

function getCampusDailyAttendance(metrics: SundayMetric[], campus: string) {
  const dailyTotals = new Map<string, number>();

  metrics.forEach((metric) => {
    if (metric.campus !== campus || !hasMetricField(metric, "attendance")) {
      return;
    }

    dailyTotals.set(metric.service_date, (dailyTotals.get(metric.service_date) ?? 0) + metric.attendance);
  });

  return Array.from(dailyTotals.entries())
    .map(([date, attendance]) => ({ date, attendance }))
    .sort((left, right) => left.date.localeCompare(right.date));
}

function answerForecastQuestion(question: string, forecast: ForecastResult) {
  const normalized = question.trim().toLowerCase();

  if (!normalized) {
    return "Ask a planning question about forecast, staffing, YoY growth, prior actuals, or what number to prepare for.";
  }

  if (!forecast.answerable) {
    return `The dashboard needs more ${forecast.campus} trend data or a prior ${forecast.eventName} actual before it can produce a reliable event projection.`;
  }

  if (normalized.includes("last year") || normalized.includes("actual")) {
    return `Last year's ${forecast.campus} actual for ${forecast.eventName} was ${formatNumber(forecast.priorEventActual)} on ${forecast.priorDate}.`;
  }

  if (normalized.includes("staff") || normalized.includes("parking") || normalized.includes("kids") || normalized.includes("seating")) {
    return `For ${forecast.eventDate}, staff around ${formatNumber(forecast.planningNumber)} people. That implies roughly ${formatNumber(forecast.volunteersNeeded)} volunteers, ${formatNumber(forecast.kidsExpected)} kids, ${formatNumber(forecast.parkingSpaces)} parking spaces, and ${formatNumber(forecast.seatingTarget)} seats across services.`;
  }

  if (normalized.includes("5500") || normalized.includes("5,500") || normalized.includes("hit")) {
    const target = normalized.includes("5500") || normalized.includes("5,500") ? 5500 : forecast.planningNumber ?? 0;
    if ((forecast.likely ?? 0) >= target) {
      return `Yes. The likely forecast is ${formatNumber(forecast.likely)}, so ${target.toLocaleString()} is inside the expected planning zone.`;
    }

    if ((forecast.high ?? 0) >= target) {
      return `Possible, but not the base case. The high forecast reaches ${formatNumber(forecast.high)}, while the likely forecast is ${formatNumber(forecast.likely)}. Leadership should plan the room for the upside if the invite push is strong.`;
    }

    return `Unlikely from the current trend. The high forecast is ${formatNumber(forecast.high)}, so hitting ${target.toLocaleString()} would require lift above the current assumption.`;
  }

  if (normalized.includes("up") || normalized.includes("year over year") || normalized.includes("yoy")) {
    return `${forecast.campus} Jan-Aug average attendance is ${formatSignedPercent(forecast.janAugGrowthPct, "not yet comparable")} year over year, moving from ${formatNumber(forecast.priorJanAugAverage)} to ${formatNumber(forecast.currentJanAugAverage)}.`;
  }

  return `The likely ${forecast.campus} projection for ${forecast.eventName} ${forecast.eventDate} is ${formatNumber(forecast.likely)}, with a low-high range of ${formatNumber(forecast.low)} to ${formatNumber(forecast.high)}. The recommended operational planning number is ${formatNumber(forecast.planningNumber)}.`;
}

function ForecastScenario({
  label,
  value,
  detail,
  featured = false,
}: {
  label: string;
  value: number | null;
  detail: string;
  featured?: boolean;
}) {
  return (
    <div className={["rounded-2xl border p-4", featured ? "border-[#2563eb] bg-white" : "border-gray-200 bg-white"].join(" ")}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-[-0.06em] text-slate-950">{formatNumber(value)}</p>
      <p className="mt-1 text-xs leading-5 text-gray-500">{detail}</p>
    </div>
  );
}

function PlanningMetric({
  icon,
  label,
  value,
  note,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2 text-gray-500">
        {icon}
        <p className="text-xs font-semibold uppercase tracking-[0.16em]">{label}</p>
      </div>
      <p className="mt-3 text-xl font-semibold tracking-[-0.04em] text-slate-950">{value}</p>
      <p className="mt-1 text-xs leading-5 text-gray-500">{note}</p>
    </div>
  );
}

function percentChangeNullable(current: number | null, prior: number | null) {
  if (current === null || prior === null || prior <= 0) return null;
  return Math.round(((current - prior) / prior) * 100);
}

function getVolatilityPercent(values: number[]) {
  if (values.length < 2) return 8;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (average <= 0) return 8;
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
  return (Math.sqrt(variance) / average) * 100;
}

function roundToNearest(value: number, nearest: number) {
  return Math.round(value / nearest) * nearest;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeEventName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "N/A";
  return Math.round(value).toLocaleString();
}

function formatSignedPercent(value: number | null | undefined, fallback = "N/A") {
  if (value === null || value === undefined || Number.isNaN(value)) return fallback;
  return `${value > 0 ? "+" : ""}${value}%`;
}
