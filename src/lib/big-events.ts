import type { SundayMetric } from "./sunday-metrics";

export type BigEventPhaseType = "pre" | "main" | "post" | "series_week" | "summary";

export type BigEventRecord = {
  id: string;
  event: string;
  eventOrder: number;
  phase: string;
  phaseOrder: number;
  phaseType: BigEventPhaseType;
  year: string;
  attendance: number;
  isTotal: boolean;
};

export type BigEventSnapshot = {
  event: string;
  eventOrder: number;
  status: "Completed" | "In progress" | "Upcoming";
  currentYear: string;
  currentTotal: number | null;
  priorTotal: number | null;
  yoyChange: number | null;
  growthSpeed: number | null;
  samePhaseDelta: number | null;
  liftFromPreEvent: number | null;
  retentionAfterEvent: number | null;
  explanation: string;
};

export type BigEventForecast = {
  event: string;
  eventOrder: number;
  forecastLow: number;
  forecastBase: number;
  forecastHigh: number;
  trend: "Accelerating" | "Stable" | "Cooling";
  rationale: string;
};

export type BigEventOverview = {
  currentYear: string;
  completed: BigEventSnapshot[];
  upcoming: BigEventForecast[];
  summary: string;
};

type BigEventsStoragePayload = {
  importedAt: string;
  records: BigEventRecord[];
};

const BIG_EVENTS_STORAGE_KEY = "church-dashboard-big-events";
export const BIG_EVENTS_UPDATED_EVENT = "church-dashboard-big-events-updated";

export function saveImportedBigEvents(records: BigEventRecord[]) {
  if (typeof window === "undefined") {
    return;
  }

  const payload: BigEventsStoragePayload = {
    importedAt: new Date().toISOString(),
    records,
  };

  window.localStorage.setItem(BIG_EVENTS_STORAGE_KEY, JSON.stringify(payload));
  window.dispatchEvent(new Event(BIG_EVENTS_UPDATED_EVENT));
}

export function clearImportedBigEvents() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(BIG_EVENTS_STORAGE_KEY);
  window.dispatchEvent(new Event(BIG_EVENTS_UPDATED_EVENT));
}

export function readImportedBigEvents(): BigEventRecord[] {
  if (typeof window === "undefined") {
    return [];
  }

  const rawValue = window.localStorage.getItem(BIG_EVENTS_STORAGE_KEY);

  if (!rawValue) {
    return [];
  }

  try {
    const payload = JSON.parse(rawValue) as BigEventsStoragePayload;
    if (!Array.isArray(payload.records)) {
      return [];
    }

    return payload.records.filter(isBigEventRecord);
  } catch {
    return [];
  }
}

export function parseBigEventsHistoricalCsv(csvText: string) {
  const rows = parseDelimitedText(csvText);
  const headerIndex = rows.findIndex((row) => normalizeCell(row[0]) === "event" && normalizeCell(row[1]) === "phase");

  if (headerIndex < 0) {
    throw new Error("This file does not match the Big 5 historical event format.");
  }

  const headerRow = rows[headerIndex];
  const yearColumns = headerRow
    .map((cell, index) => ({ value: cell.trim(), index }))
    .filter((entry) => /^\d{4}$/.test(entry.value));

  if (yearColumns.length < 2) {
    throw new Error("Could not find the year columns in the Big 5 event file.");
  }

  const records: BigEventRecord[] = [];
  let currentEvent = "";
  let currentEventOrder = 0;

  for (const row of rows.slice(headerIndex + 1)) {
    const rawEvent = row[0]?.trim() ?? "";
    const rawPhase = row[1]?.trim() ?? "";

    if (!rawEvent && !rawPhase) {
      continue;
    }

    const cleanedEvent = stripEventLabel(rawEvent);
    if (cleanedEvent.toLowerCase() === "grand total") {
      continue;
    }

    const isEventTotal = rawEvent !== "" && /total$/i.test(cleanedEvent) && rawPhase === "";

    if (rawEvent && !isEventTotal) {
      currentEvent = cleanedEvent;
      currentEventOrder = extractSequenceNumber(rawEvent) ?? currentEventOrder + 1;
    } else if (isEventTotal && !currentEvent) {
      currentEvent = stripEventTotalSuffix(cleanedEvent);
      currentEventOrder = extractSequenceNumber(rawEvent) ?? currentEventOrder + 1;
    }

    const event = isEventTotal ? stripEventTotalSuffix(cleanedEvent) : currentEvent;

    if (!event) {
      continue;
    }

    const phase = isEventTotal ? "Series Total" : stripPhaseLabel(rawPhase || cleanedEvent);
    const phaseOrder = inferPhaseOrder(rawPhase, isEventTotal);
    const phaseType = inferPhaseType(phase, isEventTotal);

    for (const { value: year, index } of yearColumns) {
      const rawValue = (row[index] ?? "").replace(/,/g, "").trim();

      if (rawValue === "") {
        continue;
      }

      const attendance = Number(rawValue);

      if (!Number.isFinite(attendance) || attendance <= 0) {
        continue;
      }

      records.push({
        id: `${event}|${phase}|${year}`,
        event,
        eventOrder: currentEventOrder,
        phase,
        phaseOrder,
        phaseType,
        year,
        attendance: Math.round(attendance),
        isTotal: isEventTotal,
      });
    }
  }

  if (records.length === 0) {
    throw new Error("No event history rows were found in that Big 5 file.");
  }

  return records.sort((left, right) => {
    if (left.eventOrder !== right.eventOrder) {
      return left.eventOrder - right.eventOrder;
    }

    if (left.year !== right.year) {
      return left.year.localeCompare(right.year);
    }

    return left.phaseOrder - right.phaseOrder;
  });
}

export function getBigEventOverview(records: BigEventRecord[], metrics: SundayMetric[]): BigEventOverview | null {
  if (records.length === 0) {
    return null;
  }

  const currentYear = getCurrentYear(records, metrics);
  const completed = buildBigEventSnapshots(records, currentYear);
  const upcoming = buildBigEventForecasts(records, metrics, currentYear);
  const completedCount = completed.filter((event) => event.status !== "Upcoming").length;
  const upsideCount = completed.filter((event) => (event.yoyChange ?? -999) > 0).length;

  const summary =
    completedCount > 0
      ? `${completedCount} Big 5 event windows already have ${currentYear} data. ${upsideCount} are currently pacing above the prior-year event window, while the rest are trailing or still normalizing.`
      : `No ${currentYear} Big 5 events have landed yet, so the event module is currently focused on forward-looking forecasts.`;

  return {
    currentYear,
    completed,
    upcoming,
    summary,
  };
}

function buildBigEventSnapshots(records: BigEventRecord[], currentYear: string): BigEventSnapshot[] {
  const events = getDistinctEvents(records);
  const priorYear = String(Number(currentYear) - 1);

  return events.map((eventName) => {
    const eventRecords = records.filter((record) => record.event === eventName);
    const currentRecords = eventRecords.filter((record) => record.year === currentYear);
    const currentTotal = getEventTotalForYear(eventRecords, currentYear);
    const priorTotal = getEventTotalForYear(eventRecords, priorYear);
    const yoyChange = currentTotal && priorTotal ? percentChange(currentTotal, priorTotal) : null;
    const priorChange = priorTotal ? getPriorEventChange(eventRecords, priorYear) : null;
    const growthSpeed = yoyChange !== null && priorChange !== null ? yoyChange - priorChange : null;
    const samePhaseDelta = getSamePhaseDelta(eventRecords, currentYear, priorYear);
    const liftFromPreEvent = getLiftFromPreEvent(eventRecords, currentYear);
    const retentionAfterEvent = getPostEventRetention(eventRecords, currentYear);
    const status =
      currentTotal
        ? "Completed"
        : currentRecords.length > 0
          ? "In progress"
          : "Upcoming";

    return {
      event: eventName,
      eventOrder: eventRecords[0]?.eventOrder ?? 0,
      status,
      currentYear,
      currentTotal,
      priorTotal,
      yoyChange,
      growthSpeed,
      samePhaseDelta,
      liftFromPreEvent,
      retentionAfterEvent,
      explanation: buildEventExplanation({
        event: eventName,
        status,
        yoyChange,
        growthSpeed,
        samePhaseDelta,
        liftFromPreEvent,
        retentionAfterEvent,
      }),
    } satisfies BigEventSnapshot;
  }).sort((left, right) => left.eventOrder - right.eventOrder);
}

function buildBigEventForecasts(records: BigEventRecord[], metrics: SundayMetric[], currentYear: string) {
  const events = getDistinctEvents(records);
  const networkChange = getNetworkYtdAttendanceChange(metrics, currentYear);

  return events
    .map((eventName) => {
      const eventRecords = records.filter((record) => record.event === eventName);
      const currentRecords = eventRecords.filter((record) => record.year === currentYear);

      if (currentRecords.length > 0 || getEventTotalForYear(eventRecords, currentYear)) {
        return null;
      }

      const totals = getHistoricalTotals(eventRecords, currentYear);
      if (totals.length < 2) {
        return null;
      }

      const weightedBase = getWeightedAverage(totals.map((entry) => entry.total));
      const recentMomentum = getAverageRecentGrowth(totals);
      const adjustmentPct = clamp(
        (networkChange ?? 0) * 0.45 + recentMomentum * 0.35,
        -15,
        15,
      );
      const forecastBase = Math.round(weightedBase * (1 + adjustmentPct / 100));
      const volatilityPct = clamp(getVolatilityPct(totals.map((entry) => entry.total)), 6, 18);
      const forecastLow = Math.round(forecastBase * (1 - volatilityPct / 100));
      const forecastHigh = Math.round(forecastBase * (1 + volatilityPct / 100));

      return {
        event: eventName,
        eventOrder: eventRecords[0]?.eventOrder ?? 0,
        forecastLow,
        forecastBase,
        forecastHigh,
        trend: recentMomentum >= 8 ? "Accelerating" : recentMomentum <= -5 ? "Cooling" : "Stable",
        rationale:
          `${eventName} is being forecast from its trailing 3-year event history, with a ${networkChange === null ? "neutral" : `${networkChange > 0 ? "+" : ""}${networkChange}%`} network YTD attendance adjustment and ${recentMomentum >= 0 ? "positive" : "negative"} event momentum weighting.`,
      } satisfies BigEventForecast;
    })
    .filter((event): event is BigEventForecast => event !== null)
    .sort((left, right) => left.eventOrder - right.eventOrder);
}

function getCurrentYear(records: BigEventRecord[], metrics: SundayMetric[]) {
  const metricYear = metrics
    .map((metric) => metric.service_date.slice(0, 4))
    .sort()
    .at(-1);

  if (metricYear) {
    return metricYear;
  }

  return records.map((record) => record.year).sort().at(-1) ?? new Date().getFullYear().toString();
}

function getDistinctEvents(records: BigEventRecord[]) {
  return Array.from(new Set(records.map((record) => record.event)));
}

function getEventTotalForYear(records: BigEventRecord[], year: string) {
  const explicitTotal = records.find((record) => record.year === year && record.isTotal);
  if (explicitTotal) {
    return explicitTotal.attendance;
  }

  const yearRows = records.filter((record) => record.year === year && record.phaseType !== "pre" && record.phaseType !== "post");
  if (yearRows.length === 0) {
    return null;
  }

  return yearRows.reduce((sum, record) => sum + record.attendance, 0);
}

function getPriorEventChange(records: BigEventRecord[], priorYear: string) {
  const previousYear = String(Number(priorYear) - 1);
  const priorTotal = getEventTotalForYear(records, priorYear);
  const previousTotal = getEventTotalForYear(records, previousYear);

  if (!priorTotal || !previousTotal) {
    return null;
  }

  return percentChange(priorTotal, previousTotal);
}

function getSamePhaseDelta(records: BigEventRecord[], currentYear: string, priorYear: string) {
  const currentRows = records.filter((record) => record.year === currentYear && !record.isTotal);
  if (currentRows.length === 0) {
    return null;
  }

  const currentPhases = currentRows.map((record) => record.phase);
  const currentSum = currentRows.reduce((sum, record) => sum + record.attendance, 0);
  const priorRows = records.filter((record) => record.year === priorYear && currentPhases.includes(record.phase) && !record.isTotal);
  const priorSum = priorRows.reduce((sum, record) => sum + record.attendance, 0);

  if (currentSum <= 0 || priorSum <= 0) {
    return null;
  }

  return percentChange(currentSum, priorSum);
}

function getLiftFromPreEvent(records: BigEventRecord[], year: string) {
  const preEvent = records.find((record) => record.year === year && record.phaseType === "pre");
  const mainEvent = records.find((record) => record.year === year && record.phaseType === "main");
  const firstSeriesWeek = records.find((record) => record.year === year && record.phaseType === "series_week");
  const anchor = mainEvent ?? firstSeriesWeek;

  if (!preEvent || !anchor) {
    return null;
  }

  return percentChange(anchor.attendance, preEvent.attendance);
}

function getPostEventRetention(records: BigEventRecord[], year: string) {
  const mainEvent = records.find((record) => record.year === year && record.phaseType === "main");
  const postWeek = records.find((record) => record.year === year && record.phaseType === "post" && /week 1/i.test(record.phase));

  if (!mainEvent || !postWeek) {
    return null;
  }

  return Math.round((postWeek.attendance / mainEvent.attendance) * 100);
}

function buildEventExplanation({
  event,
  status,
  yoyChange,
  growthSpeed,
  samePhaseDelta,
  liftFromPreEvent,
  retentionAfterEvent,
}: {
  event: string;
  status: BigEventSnapshot["status"];
  yoyChange: number | null;
  growthSpeed: number | null;
  samePhaseDelta: number | null;
  liftFromPreEvent: number | null;
  retentionAfterEvent: number | null;
}) {
  if (status === "Upcoming") {
    return `${event} has not landed in the current year yet, so the read is forward-looking only.`;
  }

  const parts: string[] = [];

  if (yoyChange !== null) {
    parts.push(`${event} is ${yoyChange > 0 ? "up" : "down"} ${Math.abs(yoyChange)}% versus the same event window last year.`);
  } else if (samePhaseDelta !== null) {
    parts.push(`${event} is ${samePhaseDelta > 0 ? "running above" : "running below"} last year's same completed phases by ${Math.abs(samePhaseDelta)}%.`);
  }

  if (growthSpeed !== null) {
    parts.push(
      growthSpeed >= 5
        ? "Growth speed is improving versus the prior event cycle."
        : growthSpeed <= -5
          ? "Growth speed has cooled versus the prior event cycle."
          : "Growth speed is broadly stable versus the prior event cycle.",
    );
  }

  if (liftFromPreEvent !== null) {
    parts.push(`The event-week lift off the pre-event baseline is ${liftFromPreEvent > 0 ? "+" : ""}${liftFromPreEvent}%.`);
  }

  if (retentionAfterEvent !== null) {
    parts.push(`Week-1 retention is ${retentionAfterEvent}% of the main event peak.`);
  }

  return parts.join(" ");
}

function getHistoricalTotals(records: BigEventRecord[], currentYear: string) {
  return Array.from(new Set(records.map((record) => record.year)))
    .filter((year) => Number(year) < Number(currentYear))
    .sort()
    .map((year) => ({ year, total: getEventTotalForYear(records, year) ?? 0 }))
    .filter((entry) => entry.total > 0);
}

function getAverageRecentGrowth(totals: Array<{ year: string; total: number }>) {
  const changes = totals
    .slice(-3)
    .map((entry, index, array) => {
      if (index === 0) {
        return null;
      }

      const prior = array[index - 1];
      return percentChange(entry.total, prior.total);
    })
    .filter((change): change is number => change !== null);

  if (changes.length === 0) {
    return 0;
  }

  return Math.round(changes.reduce((sum, change) => sum + change, 0) / changes.length);
}

function getNetworkYtdAttendanceChange(metrics: SundayMetric[], currentYear: string) {
  const currentDates = metrics
    .map((metric) => metric.service_date)
    .filter((date) => date.startsWith(currentYear))
    .sort();

  const latestDate = currentDates.at(-1);

  if (!latestDate) {
    return null;
  }

  const priorYear = String(Number(currentYear) - 1);
  const cutoff = latestDate.slice(5);
  const currentTotal = metrics
    .filter((metric) => metric.service_date.startsWith(currentYear))
    .reduce((sum, metric) => sum + metric.attendance, 0);
  const priorTotal = metrics
    .filter((metric) => metric.service_date.startsWith(priorYear) && metric.service_date.slice(5) <= cutoff)
    .reduce((sum, metric) => sum + metric.attendance, 0);

  if (currentTotal <= 0 || priorTotal <= 0) {
    return null;
  }

  return percentChange(currentTotal, priorTotal);
}

function getWeightedAverage(values: number[]) {
  const recentValues = values.slice(-3);
  const weights = recentValues.map((_, index) => index + 1);
  const weightedTotal = recentValues.reduce((sum, value, index) => sum + value * weights[index], 0);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  return totalWeight > 0 ? weightedTotal / totalWeight : 0;
}

function getVolatilityPct(values: number[]) {
  if (values.length < 2) {
    return 8;
  }

  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (average <= 0) {
    return 8;
  }

  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
  return Math.round((Math.sqrt(variance) / average) * 100);
}

function percentChange(current: number, prior: number) {
  return Math.round(((current - prior) / prior) * 100);
}

function normalizeCell(value: string | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function stripEventLabel(value: string) {
  return stripEventTotalSuffix(value.replace(/^\d+\s+/, "").trim());
}

function stripEventTotalSuffix(value: string) {
  return value.replace(/\s+total$/i, "").trim();
}

function stripPhaseLabel(value: string) {
  return value.replace(/^\d+\s+/, "").trim();
}

function extractSequenceNumber(value: string) {
  const match = value.trim().match(/^(\d+)/);
  return match ? Number(match[1]) : null;
}

function inferPhaseOrder(value: string, isEventTotal: boolean) {
  if (isEventTotal) {
    return 99;
  }

  return extractSequenceNumber(value) ?? 50;
}

function inferPhaseType(value: string, isEventTotal: boolean): BigEventPhaseType {
  const normalized = value.toLowerCase();

  if (isEventTotal) {
    return "summary";
  }

  if (normalized.includes("pre event")) {
    return "pre";
  }

  if (normalized.includes("post week")) {
    return "post";
  }

  if (normalized === "total") {
    return "main";
  }

  if (normalized.includes("week")) {
    return "series_week";
  }

  return "main";
}

function parseDelimitedText(text: string) {
  const rows: string[][] = [];
  let currentCell = "";
  let currentRow: string[] = [];
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"') {
      if (insideQuotes && nextCharacter === '"') {
        currentCell += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (character === "," && !insideQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !insideQuotes) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }

      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += character;
  }

  if (currentCell !== "" || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function isBigEventRecord(candidate: unknown): candidate is BigEventRecord {
  if (typeof candidate !== "object" || candidate === null) {
    return false;
  }

  const record = candidate as Record<string, unknown>;

  return typeof record.id === "string"
    && typeof record.event === "string"
    && typeof record.eventOrder === "number"
    && typeof record.phase === "string"
    && typeof record.phaseOrder === "number"
    && typeof record.phaseType === "string"
    && typeof record.year === "string"
    && typeof record.attendance === "number"
    && typeof record.isTotal === "boolean";
}
