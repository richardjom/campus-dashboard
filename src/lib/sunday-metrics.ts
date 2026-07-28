import preloadedCampusBundleJson from "../data/preloaded-campus-bundle.json";
import { chartDataset, type CampusSnapshot, type ComparisonFilters, type Period, type KpiCard, type KpiKey, getMetricLabel } from "./mock-data";

export type MetricField = "attendance" | "volunteers" | "first_time_guests" | "salvations" | "kids" | "growth_track" | "baptism";

export type SundayMetric = {
  id: string;
  service_date: string;
  campus: string;
  service_time?: string;
  attendance: number;
  volunteers: number;
  first_time_guests: number;
  salvations: number;
  kids: number;
  growth_track: number;
  baptism: number;
  notes: string;
  available_metrics?: MetricField[];
};

export type SundayMetricsSource = "mock" | "imported" | "bundle";

export type ComparisonDatasetPoint = {
  label: string;
  values: Record<string, number>;
  leader: string;
  spread: number;
  total: number;
};

export const churchGrowthBenchmarks = {
  yoyAttendanceGrowthTarget: 0.2,
  firstTimeGuestRateMin: 0.02,
  firstTimeGuestRateMax: 0.04,
  kidsRatioMin: 0.2,
  kidsRatioMax: 0.25,
  weeklyVolunteerCoverageWatch: 0.14,
  weeklyVolunteerCoverageHealthy: 0.16,
  volunteerRosterTarget: 0.4,
  growthTrackCompletionTarget: 0.75,
  growthTrackToServeTarget: 0.8,
  volunteerAnnualChurnTarget: 0.15,
};

export const executiveReportLenses = [
  "Reach",
  "Connection",
  "Capacity",
] as const;

type ExecutiveReportLens = (typeof executiveReportLenses)[number] | "Seasonality" | "Leadership Context" | "Data Quality" | "Replication";

type MetricsStoragePayload = {
  importedAt: string;
  metrics: SundayMetric[];
};

const STORAGE_KEY = "church-dashboard-imported-metrics";
export const METRICS_UPDATED_EVENT = "church-dashboard-metrics-updated";

const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const allMetricFields: MetricField[] = ["attendance", "volunteers", "first_time_guests", "salvations", "kids", "growth_track", "baptism"];
const coreSnapshotFields: MetricField[] = ["attendance", "volunteers", "first_time_guests", "salvations"];

const metricFieldMap: Record<KpiKey, MetricField> = {
  attendance: "attendance",
  volunteers: "volunteers",
  firstTimeGuests: "first_time_guests",
  salvations: "salvations",
  kids: "kids",
  growthTrack: "growth_track",
  baptism: "baptism",
};

const defaultMetrics = buildDefaultMetrics();

export function resolveSundayMetricsDataset(): { metrics: SundayMetric[]; source: SundayMetricsSource } {
  const imported = readImportedMetrics();

  if (imported.length > 0) {
    return {
      metrics: mergeSundayMetrics(preloadedCampusBundle, imported),
      source: "imported",
    };
  }

  if (preloadedCampusBundle.length > 0) {
    return {
      metrics: preloadedCampusBundle,
      source: "bundle",
    };
  }

  return {
    metrics: defaultMetrics,
    source: "mock",
  };
}

export function saveImportedMetrics(metrics: SundayMetric[]) {
  if (typeof window === "undefined") {
    return;
  }

  const payload: MetricsStoragePayload = {
    importedAt: new Date().toISOString(),
    metrics,
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  window.dispatchEvent(new Event(METRICS_UPDATED_EVENT));
}

export function mergeSundayMetrics(existingMetrics: SundayMetric[], incomingMetrics: SundayMetric[]) {
  const merged = new Map<string, SundayMetric>();

  existingMetrics.forEach((metric) => {
    merged.set(getMetricMergeKey(metric), metric);
  });

  incomingMetrics.forEach((metric) => {
    const key = getMetricMergeKey(metric);
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, metric);
      return;
    }

    const incomingFields = getRecordAvailableMetricFields(metric);
    const existingFields = getRecordAvailableMetricFields(existing);
    const next: SundayMetric = {
      ...existing,
      ...metric,
      id: key,
      service_time: metric.service_time ?? existing.service_time,
      notes: appendMetricNote(existing.notes, metric.notes),
      available_metrics: Array.from(new Set([...existingFields, ...incomingFields])),
    };

    allMetricFields.forEach((field) => {
      next[field] = incomingFields.includes(field) ? metric[field] : existing[field];
    });

    merged.set(key, next);
  });

  return Array.from(merged.values()).sort((left, right) => {
    if (left.service_date === right.service_date) {
      if (left.campus === right.campus) {
        return (left.service_time ?? "").localeCompare(right.service_time ?? "");
      }

      return left.campus.localeCompare(right.campus);
    }

    return left.service_date.localeCompare(right.service_date);
  });
}

export function clearImportedMetrics() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(METRICS_UPDATED_EVENT));
}

export function readImportedMetrics(): SundayMetric[] {
  if (typeof window === "undefined") {
    return [];
  }

  const rawValue = window.localStorage.getItem(STORAGE_KEY);

  if (!rawValue) {
    return [];
  }

  try {
    const payload = JSON.parse(rawValue) as MetricsStoragePayload;

    if (!Array.isArray(payload.metrics)) {
      return [];
    }

    const importedMetrics = payload.metrics.filter(isSundayMetric);
    const { metrics: repairedMetrics, changed } = sanitizeImportedMetrics(importedMetrics);

    if (changed) {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          ...payload,
          metrics: repairedMetrics,
        }),
      );
    }

    return repairedMetrics;
  } catch {
    return [];
  }
}

export function parseSundayMetricsCsv(csvText: string) {
  const rows = parseDelimitedText(csvText);

  if (rows.length < 2) {
    throw new Error("The file needs a header row and at least one data row.");
  }

  const headers = rows[0].map((header) => normalizeHeader(header));
  const requiredHeaders = [
    "service_date",
    "campus",
    "attendance",
    "volunteers",
    "first_time_guests",
    "salvations",
  ];

  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));

  if (missingHeaders.length > 0) {
    throw new Error(`Missing required columns: ${missingHeaders.join(", ")}`);
  }

  const metrics: SundayMetric[] = rows.slice(1).filter((row) => row.some((cell) => cell.trim() !== "")).map((row, rowIndex) => {
    const record = Object.fromEntries(headers.map((header, headerIndex) => [header, row[headerIndex]?.trim() ?? ""]));
    const serviceDate = record.service_date;
    const campus = record.campus;

    if (!isIsoDate(serviceDate)) {
      throw new Error(`Row ${rowIndex + 2} has an invalid service_date. Use YYYY-MM-DD.`);
    }

    if (!campus) {
      throw new Error(`Row ${rowIndex + 2} is missing campus.`);
    }

    return {
      id: record.id || `${serviceDate}-${campus}-${rowIndex}`,
      service_date: serviceDate,
      campus,
      service_time: record.service_time || undefined,
      attendance: parseMetricNumber(record.attendance, rowIndex, "attendance"),
      volunteers: parseMetricNumber(record.volunteers, rowIndex, "volunteers"),
      first_time_guests: parseMetricNumber(record.first_time_guests, rowIndex, "first_time_guests"),
      salvations: parseMetricNumber(record.salvations, rowIndex, "salvations"),
      kids: parseOptionalMetricNumber(record.kids),
      growth_track: parseOptionalMetricNumber(record.growth_track),
      baptism: parseOptionalMetricNumber(record.baptism),
      notes: record.notes || "",
    };
  });

  return metrics.sort((left, right) => left.service_date.localeCompare(right.service_date));
}

export async function parseCampusDashboardBundle(files: File[]) {
  const bundleParts = await Promise.all(
    files.map(async (file) => ({
      name: file.name,
      text: await file.text(),
    })),
  );

  return parseCampusDashboardBundleFromParts(bundleParts);
}

export function parseCampusDashboardBundleFromParts(
  files: Array<{ name: string; text: string }>,
) {
  const merged = new Map<string, SundayMetric>();
  let matchedFileCount = 0;

  files.forEach((file) => {
    const experienceSummaryRecords = parseExperienceSummaryCsv(file.text);

    if (experienceSummaryRecords) {
      matchedFileCount += 1;

      experienceSummaryRecords.forEach((record) => {
        merged.set(getMetricMergeKey(record), record);
      });
      return;
    }

    const metricType = inferBundleMetricType(file.name);

    if (!metricType) {
      return;
    }

    matchedFileCount += 1;

    const records = parseWeeklyCampusMetricCsv(file.text);

    records.forEach((record) => {
      const key = [record.service_date, record.campus, ""].join("|");
      const existing = merged.get(key) ?? createEmptyMetricRecord(record.service_date, record.campus);

      existing[metricType] = record.value;
      existing.available_metrics = Array.from(new Set([...(existing.available_metrics ?? []), metricType]));
      merged.set(key, existing);
    });
  });

  const normalized = Array.from(merged.values()).sort((left, right) => {
    if (left.service_date === right.service_date) {
      return left.campus.localeCompare(right.campus);
    }

    return left.service_date.localeCompare(right.service_date);
  });

  if (normalized.length === 0 || matchedFileCount === 0) {
    throw new Error("None of the uploaded files matched the campus dashboard bundle format.");
  }

  return normalized;
}

export async function parseHistoricalMetricsFiles(files: File[]) {
  const parts = await Promise.all(
    files.map(async (file) => ({
      name: file.name,
      text: await file.text(),
    })),
  );

  return parseHistoricalMetricsFilesFromParts(parts);
}

export function parseHistoricalMetricsFilesFromParts(
  files: Array<{ name: string; text: string }>,
) {
  if (files.length === 0) {
    throw new Error("Select at least one CSV file to import.");
  }

  if (files.length === 1) {
    const [file] = files;

    try {
      return parseSundayMetricsCsv(file.text);
    } catch (flatCsvError) {
      try {
        return parseCampusDashboardBundleFromParts(files);
      } catch (bundleError) {
        const flatMessage = flatCsvError instanceof Error ? flatCsvError.message : "Unknown flat CSV error.";
        const bundleMessage = bundleError instanceof Error ? bundleError.message : "Unknown bundle CSV error.";
        throw new Error(`Could not parse ${file.name}. Flat schema read failed with: ${flatMessage} Bundle read failed with: ${bundleMessage}`);
      }
    }
  }

  return parseCampusDashboardBundleFromParts(files);
}

export function deriveKpiCardsFromMetrics(metrics: SundayMetric[]): KpiCard[] {
  const buildMetricCard = (key: KpiKey, label: string) => {
    const field = metricFieldMap[key];
    const metricRecords = filterMetricsByField(metrics, field);
    const uniqueDates = getUniqueSortedDates(metricRecords);

    if (uniqueDates.length === 0) {
      return null;
    }

    const recentDates = uniqueDates.slice(-4);
    const baselineDates = uniqueDates.slice(-8, -4);
    const sparklineDates = uniqueDates.slice(-12);
    const latestDate = uniqueDates.at(-1) ?? null;
    const sumForDates = (dateList: string[]) =>
      metricRecords
        .filter((metric) => dateList.includes(metric.service_date))
        .reduce((sum, metric) => sum + metric[field], 0);

    const recentAverage = recentDates.length > 0 ? Math.round(sumForDates(recentDates) / recentDates.length) : 0;
    const baselineAverage = baselineDates.length > 0 ? Math.round(sumForDates(baselineDates) / baselineDates.length) : 0;
    const sparkline = sparklineDates.map((date) => sumForDates([date]));
    const footnote = latestDate
      ? `4-wk avg vs prior 4 wk · through ${formatShortDateLabel(latestDate)}`
      : "4-wk avg vs prior 4 wk";

    return buildKpiCard(key, label, recentAverage, baselineAverage, footnote, sparkline);
  };

  return [
    buildMetricCard("attendance", "Weekly attendance"),
    buildMetricCard("volunteers", "Volunteer coverage"),
    buildMetricCard("firstTimeGuests", "First-time guests"),
    buildMetricCard("salvations", "Salvations"),
  ].filter((card): card is KpiCard => card !== null);
}

export type YtdSummary = {
  key: KpiKey;
  label: string;
  ytdValue: number;
  priorYtdValue: number;
  pctChange: number;
  weeksElapsed: number;
};

export function deriveYtdSummary(metrics: SundayMetric[]): YtdSummary[] {
  const buildYtd = (key: KpiKey, label: string): YtdSummary | null => {
    const field = metricFieldMap[key];
    const metricRecords = filterMetricsByField(metrics, field);
    const uniqueDates = getUniqueSortedDates(metricRecords);

    if (uniqueDates.length === 0) {
      return null;
    }

    const latestDate = uniqueDates[uniqueDates.length - 1];
    const latestYear = latestDate.slice(0, 4);
    const priorYear = String(Number(latestYear) - 1);
    const cutoffMonthDay = latestDate.slice(5);
    const ytdDates = uniqueDates.filter((date) => date.startsWith(latestYear));
    const priorYtdDates = uniqueDates.filter((date) => date.startsWith(priorYear) && date.slice(5) <= cutoffMonthDay);
    const current = metricRecords
      .filter((metric) => ytdDates.includes(metric.service_date))
      .reduce((sum, metric) => sum + metric[field], 0);
    const prior = metricRecords
      .filter((metric) => priorYtdDates.includes(metric.service_date))
      .reduce((sum, metric) => sum + metric[field], 0);

    return {
      key,
      label,
      ytdValue: current,
      priorYtdValue: prior,
      pctChange: prior === 0 ? 0 : Math.round(((current - prior) / prior) * 100),
      weeksElapsed: ytdDates.length,
    };
  };

  return [
    buildYtd("attendance", "Attendance"),
    buildYtd("volunteers", "Volunteers"),
    buildYtd("firstTimeGuests", "First-time guests"),
    buildYtd("salvations", "Salvations"),
  ].filter((row): row is YtdSummary => row !== null);
}

function zeroTotals() {
  return { attendance: 0, volunteers: 0, first_time_guests: 0, salvations: 0, kids: 0, growth_track: 0, baptism: 0 };
}

function averageTotals(sum: ReturnType<typeof zeroTotals>, divisor: number) {
  if (divisor === 0) return sum;
  return {
    attendance: Math.round(sum.attendance / divisor),
    volunteers: Math.round(sum.volunteers / divisor),
    first_time_guests: Math.round(sum.first_time_guests / divisor),
    salvations: Math.round(sum.salvations / divisor),
    kids: Math.round(sum.kids / divisor),
    growth_track: Math.round(sum.growth_track / divisor),
    baptism: Math.round(sum.baptism / divisor),
  };
}

export function deriveCampusSnapshotsFromMetrics(metrics: SundayMetric[]): CampusSnapshot[] {
  const completeMetrics = filterMetricsByFields(metrics, coreSnapshotFields);
  const latestDate = getUniqueSortedDates(completeMetrics).at(-1);

  if (!latestDate) {
    return [];
  }

  const campuses = getAvailableCampuses(completeMetrics);

  return campuses.map((campus) => {
    const campusRecords = completeMetrics.filter((metric) => metric.campus === campus);
    const latestCampusRecords = campusRecords.filter((metric) => metric.service_date === latestDate);
    const latestTotals = aggregateTotals(latestCampusRecords);
    const priorDate = getUniqueSortedDates(campusRecords.filter((metric) => metric.service_date < latestDate)).at(-1);
    const priorTotals = priorDate
      ? aggregateTotals(campusRecords.filter((metric) => metric.service_date === priorDate))
      : latestTotals;
    const attendanceDelta = priorTotals.attendance === 0
      ? 0
      : (latestTotals.attendance - priorTotals.attendance) / priorTotals.attendance;

    return {
      campus,
      attendance: latestTotals.attendance,
      volunteers: latestTotals.volunteers,
      firstTimeGuests: latestTotals.first_time_guests,
      salvations: latestTotals.salvations,
      status:
        attendanceDelta > 0.03
          ? "Growing"
          : attendanceDelta < -0.03
            ? "Needs follow-up"
            : "Stable",
    };
  });
}

export function getAvailableCampuses(metrics: SundayMetric[]) {
  return Array.from(new Set(metrics.map((metric) => metric.campus))).sort();
}

export type TrendAlert = {
  campus: string;
  metricLabel: string;
  recentAvg: number;
  baselineAvg: number;
  pctChange: number;
  direction: "up" | "down";
};

export type AnomalyAlert = {
  campus: string;
  date: string;
  metricLabel: string;
  value: number;
  expected: number;
  deviationPct: number;
  direction: "spike" | "drop";
};

export type CampusHealth = {
  campus: string;
  attendance: number;
  volunteerRatio: number;
  kidsRatio: number;
  ftgRate: number;
  volunteerStatus: "Healthy" | "Watch" | "Strained";
  kidsStatus: "Healthy" | "Watch" | "Strained";
  ftgStatus: "Strong" | "Healthy" | "Watch";
};

export type ExecutiveBrief = {
  headline: string;
  summary: string;
  tone: "positive" | "warning" | "neutral";
};

export type ExecutiveFinding = {
  title: string;
  detail: string;
  tone: "positive" | "warning" | "neutral";
  lens: ExecutiveReportLens;
};

type DiagnosticFinding = ExecutiveFinding & {
  priorityScore: number;
};

export type ExecutiveActionCard = {
  campus: string;
  lens: ExecutiveReportLens;
  urgency: "Decide now" | "This week" | "Monitor";
  title: string;
  diagnosis: string;
  hypothesis: string;
  evidence: string[];
  decision: string;
  nextMove: string;
  dataToConfirm: string[];
};

export type GrowthVerdict = "Strong" | "Healthy" | "Watch" | "Critical";

export type LifecycleStage = "Launch / Year 1" | "Stabilizing / Years 2-3" | "Mature / 3+ years";

export type TransitionContextEvent = {
  campus: string;
  date: string;
  type: "Campus Pastor Change" | "Staff Transition" | "Leadership Transition";
  note: string;
  timing: "Within scope" | "Preceded scope";
};

export type ExecutiveCampusReview = {
  campus: string;
  lifecycle: LifecycleStage;
  verdict: GrowthVerdict;
  currentChange: number;
  priorChange: number | null;
  acceleration: number | null;
  seasonalDelta: number | null;
  volatility: number;
  reason: string;
};

export type ExecutiveScorecard = {
  verdict: GrowthVerdict;
  summary: string;
  currentChange: number;
  priorChange: number | null;
  acceleration: number | null;
  seasonalDelta: number | null;
  transitions: TransitionContextEvent[];
  campuses: ExecutiveCampusReview[];
  dataCaveat: string;
};

export type DashboardInsights = {
  scorecard: ExecutiveScorecard | null;
  executiveBrief: ExecutiveBrief | null;
  actionCards: ExecutiveActionCard[];
  findings: ExecutiveFinding[];
  trendAlerts: TrendAlert[];
  anomalies: AnomalyAlert[];
  health: CampusHealth[];
  latestDate: string | null;
  scopedCampuses: string[];
  metricLabel: string;
};

const insightMetrics: Array<{ field: MetricField; label: string }> = [
  { field: "attendance", label: "Attendance" },
  { field: "volunteers", label: "Volunteers" },
  { field: "first_time_guests", label: "First-time guests" },
  { field: "salvations", label: "Salvations" },
  { field: "kids", label: "Kids" },
  { field: "growth_track", label: "Growth Track" },
];

export function getDashboardInsights(metrics: SundayMetric[], filters?: ComparisonFilters): DashboardInsights {
  const selectedCampuses = filters?.selectedCampuses.filter(Boolean) ?? [];
  const scopedCampuses = selectedCampuses.length > 0 ? selectedCampuses : getAvailableCampuses(metrics);
  const scopedMetrics = scopedCampuses.length > 0
    ? metrics.filter((metric) => scopedCampuses.includes(metric.campus))
    : metrics;
  const metricBearingRecords = scopedMetrics.filter((metric) => getRecordAvailableMetricFields(metric).length > 0);
  const dates = getUniqueSortedDates(metricBearingRecords);
  const latestDate = dates.at(-1) ?? null;
  const campuses = scopedCampuses;

  const trendAlerts: TrendAlert[] = [];
  const anomalies: AnomalyAlert[] = [];

  for (const campus of campuses) {
    const campusRecords = scopedMetrics
      .filter((m) => m.campus === campus)
      .sort((a, b) => a.service_date.localeCompare(b.service_date));

    if (campusRecords.length < 8) continue;

    for (const { field, label } of insightMetrics) {
      const fieldRecords = buildCampusMetricDateSeries(campusRecords, field);
      if (fieldRecords.length < 8) continue;

      const values = fieldRecords.map((r) => r.value);
      const recentValues = values.slice(-4).filter((v) => v > 0);
      const baselineValues = values.slice(-8, -4).filter((v) => v > 0);

      if (recentValues.length < 2 || baselineValues.length < 2) continue;

      const recentAvg = mean(recentValues);
      const baselineAvg = mean(baselineValues);
      if (baselineAvg === 0) continue;

      const pctChange = Math.round(((recentAvg - baselineAvg) / baselineAvg) * 100);
      if (Math.abs(pctChange) >= 8) {
        trendAlerts.push({
          campus,
          metricLabel: label,
          recentAvg: Math.round(recentAvg),
          baselineAvg: Math.round(baselineAvg),
          pctChange,
          direction: pctChange > 0 ? "up" : "down",
        });
      }

      // Anomaly detection — only on attendance to keep the list focused
      if (field === "attendance") {
        const last8 = fieldRecords.slice(-8);
        for (let i = 4; i < last8.length; i++) {
          const target = last8[i];
          const window = last8.slice(Math.max(0, i - 4), i).map((r) => r.value).filter((v) => v > 0);
          if (window.length < 3 || target.value === 0) continue;
          const expected = mean(window);
          if (expected === 0) continue;
          const deviationPct = Math.round(((target.value - expected) / expected) * 100);
          if (Math.abs(deviationPct) >= 20) {
            anomalies.push({
              campus,
              date: target.service_date,
              metricLabel: label,
              value: target.value,
              expected: Math.round(expected),
              deviationPct,
              direction: deviationPct > 0 ? "spike" : "drop",
            });
          }
        }
      }
    }
  }

  // Health ratios from latest date
  const health: CampusHealth[] = [];
  const latestCompleteDate = getUniqueSortedDates(filterMetricsByFields(scopedMetrics, coreSnapshotFields)).at(-1) ?? null;
  if (latestCompleteDate) {
    for (const campus of campuses) {
      const latestRecords = scopedMetrics.filter((m) => m.campus === campus && m.service_date === latestCompleteDate && hasMetricFields(m, coreSnapshotFields));
      const latest = aggregateTotals(latestRecords);
      if (latest.attendance === 0) continue;
      const volunteerRatio = latest.volunteers / latest.attendance;
      const kidsRatio = latest.kids / latest.attendance;
      const ftgRate = latest.first_time_guests / latest.attendance;
      health.push({
        campus,
        attendance: latest.attendance,
        volunteerRatio,
        kidsRatio,
        ftgRate,
        volunteerStatus: classifyVolunteerCoverage(volunteerRatio),
        kidsStatus: classifyKidsRatio(kidsRatio),
        ftgStatus: classifyFirstTimeGuestRate(ftgRate),
      });
    }
  }

  // Sort: most concerning trends first (largest absolute % change, declining first within ties)
  trendAlerts.sort((a, b) => {
    const absDiff = Math.abs(b.pctChange) - Math.abs(a.pctChange);
    if (absDiff !== 0) return absDiff;
    return a.pctChange - b.pctChange;
  });

  // Sort anomalies by recency, then deviation magnitude
  anomalies.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return Math.abs(b.deviationPct) - Math.abs(a.deviationPct);
  });

  const scorecard = filters
    ? buildExecutiveScorecard(scopedMetrics, filters, campuses)
    : null;
  const executiveBrief = filters
    ? buildExecutiveBrief(scopedMetrics, filters, campuses)
    : buildExecutiveBriefFromLatest(health, latestDate);
  const findings = filters
    ? buildExecutiveFindings(scopedMetrics, filters, campuses)
    : [];
  const actionCards = filters
    ? buildExecutiveActionCards(scopedMetrics, filters, campuses)
    : [];

  return {
    scorecard,
    executiveBrief,
    actionCards,
    findings,
    trendAlerts: trendAlerts.slice(0, 6),
    anomalies: anomalies.slice(0, 5),
    health: health.sort((a, b) => b.attendance - a.attendance),
    latestDate,
    scopedCampuses: campuses,
    metricLabel: getMetricLabel(filters?.metric ?? "attendance"),
  };
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = mean(values.map((value) => (value - avg) ** 2));
  return Math.sqrt(variance);
}

function buildCampusMetricDateSeries(records: SundayMetric[], field: MetricField): Array<{ service_date: string; value: number }> {
  const totalsByDate = new Map<string, number>();

  records
    .filter((record) => hasMetricField(record, field))
    .forEach((record) => {
      totalsByDate.set(record.service_date, (totalsByDate.get(record.service_date) ?? 0) + record[field]);
    });

  return Array.from(totalsByDate.entries())
    .map(([service_date, value]) => ({ service_date, value }))
    .sort((left, right) => left.service_date.localeCompare(right.service_date));
}

function classifyVolunteerCoverage(value: number): CampusHealth["volunteerStatus"] {
  if (value >= churchGrowthBenchmarks.weeklyVolunteerCoverageHealthy) return "Healthy";
  if (value >= churchGrowthBenchmarks.weeklyVolunteerCoverageWatch) return "Watch";
  return "Strained";
}

function classifyKidsRatio(value: number): CampusHealth["kidsStatus"] {
  if (value >= churchGrowthBenchmarks.kidsRatioMin && value <= churchGrowthBenchmarks.kidsRatioMax) return "Healthy";
  if (value >= churchGrowthBenchmarks.kidsRatioMin * 0.8 && value <= churchGrowthBenchmarks.kidsRatioMax * 1.15) return "Watch";
  return "Strained";
}

function classifyFirstTimeGuestRate(value: number): CampusHealth["ftgStatus"] {
  if (value >= churchGrowthBenchmarks.firstTimeGuestRateMax) return "Strong";
  if (value >= churchGrowthBenchmarks.firstTimeGuestRateMin) return "Healthy";
  return "Watch";
}

type PeriodPerformanceSummary = {
  currentTotal: number;
  priorTotal: number;
  priorPeriod: Period | null;
  currentChange: number;
  priorPriorTotal: number;
  priorPriorPeriod: Period | null;
  priorChange: number | null;
  acceleration: number | null;
  historicalBaseline: number | null;
  seasonalDelta: number | null;
};

function buildExecutiveScorecard(
  metrics: SundayMetric[],
  filters: ComparisonFilters,
  campuses: string[],
): ExecutiveScorecard | null {
  if (campuses.length === 0) return null;

  const performance = summarizePeriodPerformance(metrics, campuses, filters.periodA, filters.metric, filters.periodB);
  const transitions = getTransitionContextEvents(metrics, campuses, filters.periodA, filters.periodB);
  const campusReviews = campuses.map((campus) => {
    const campusPerformance = summarizePeriodPerformance(metrics, [campus], filters.periodA, filters.metric, filters.periodB);
    const lifecycle = getLifecycleStage(metrics, campus, Number(filters.periodA.year));
    const profile = buildCampusProfile(metrics, campus, filters.periodA, filters.periodB);
    const volatility = calculateCampusVolatility(getComparisonDatasetFromMetrics(metrics, { ...filters, selectedCampuses: [campus] }), campus);
    const campusVerdict = classifyGrowthVerdict({
      currentChange: campusPerformance.currentChange,
      acceleration: campusPerformance.acceleration,
      seasonalDelta: campusPerformance.seasonalDelta,
      volatility,
      volunteerRatio: profile?.volunteerRatio ?? null,
      kidsRatio: profile?.kidsRatio ?? null,
      ftgRate: profile?.ftgRate ?? null,
    });

    return {
      campus,
      lifecycle,
      verdict: campusVerdict.verdict,
      currentChange: campusPerformance.currentChange,
      priorChange: campusPerformance.priorChange,
      acceleration: campusPerformance.acceleration,
      seasonalDelta: campusPerformance.seasonalDelta,
      volatility,
      reason: campusVerdict.reason,
    } satisfies ExecutiveCampusReview;
  });

  const portfolioVerdict = classifyGrowthVerdict({
    currentChange: performance.currentChange,
    acceleration: performance.acceleration,
    seasonalDelta: performance.seasonalDelta,
    volatility: Math.round(avgNumber(campusReviews.map((review) => review.volatility))),
    volunteerRatio: avgNumber(
      campuses
        .map((campus) => buildCampusProfile(metrics, campus, filters.periodA, filters.periodB)?.volunteerRatio ?? 0)
        .filter((ratio) => ratio > 0),
    ) || null,
    kidsRatio: avgNumber(
      campuses
        .map((campus) => buildCampusProfile(metrics, campus, filters.periodA, filters.periodB)?.kidsRatio ?? 0)
        .filter((ratio) => ratio > 0),
    ) || null,
    ftgRate: avgNumber(
      campuses
        .map((campus) => buildCampusProfile(metrics, campus, filters.periodA, filters.periodB)?.ftgRate ?? 0)
        .filter((ratio) => ratio > 0),
    ) || null,
  });

  const dataCaveat = buildScorecardCaveat(performance, transitions);
  const metricLabel = getMetricLabel(filters.metric).toLowerCase();
  const summaryParts = [
    `Using the Reach, Connection, and Capacity framework, the selected scope is ${portfolioVerdict.verdict.toLowerCase()} for ${metricLabel} right now, moving ${performance.currentChange > 0 ? "up" : performance.currentChange < 0 ? "down" : "flat"} ${Math.abs(performance.currentChange)}% versus the comparable prior period.`,
    `The reach benchmark is 20% year-over-year growth, while connection and capacity are checked against first-time guest flow, kids/family mix, Growth Track activity, and weekly volunteer coverage.`,
    performance.acceleration !== null
      ? `Growth speed is ${performance.acceleration > 2 ? "accelerating" : performance.acceleration < -2 ? "slowing" : "holding roughly steady"}${performance.priorChange !== null ? `, after ${performance.priorChange > 0 ? "+" : ""}${performance.priorChange}% in the prior comparison cycle` : ""}.`
      : `Growth speed cannot be fully measured yet because there is not enough earlier history for a second comparison layer.`,
    performance.seasonalDelta !== null
      ? `Against the same seasonal window across older years, the scope is ${performance.seasonalDelta > 0 ? "running above" : performance.seasonalDelta < 0 ? "running below" : "tracking in line with"} historical baseline by ${Math.abs(performance.seasonalDelta)}%.`
      : `A seasonal baseline is not yet deep enough to say whether current performance is above or below the normal rhythm for this window.`,
    transitions.length > 0
      ? `${transitions.length} logged leadership transition${transitions.length === 1 ? "" : "s"} sit ${transitions.some((event) => event.timing === "Within scope") ? "inside or immediately around" : "just ahead of"} the selected window, so growth should be read with those changes in mind.`
      : `No campus pastor or staff transitions are logged for this scope yet, so the report cannot attribute current changes to leadership handoffs until those events are added.`,
  ];

  return {
    verdict: portfolioVerdict.verdict,
    summary: summaryParts.join(" "),
    currentChange: performance.currentChange,
    priorChange: performance.priorChange,
    acceleration: performance.acceleration,
    seasonalDelta: performance.seasonalDelta,
    transitions,
    campuses: campusReviews,
    dataCaveat,
  };
}

function summarizePeriodPerformance(
  metrics: SundayMetric[],
  campuses: string[],
  period: Period,
  metric: KpiKey,
  comparison?: Period,
): PeriodPerformanceSummary {
  const currentTotal = getMetricTotalForCampusesPeriod(metrics, campuses, period, metric);
  const priorPeriod = comparison ?? derivePriorPeriod(period);
  const priorCutoffMonthDay = priorPeriod ? getComparisonCutoffMonthDay(metrics, period, priorPeriod) : null;
  const priorTotal = priorPeriod
    ? getMetricTotalForCampusesPeriod(metrics, campuses, priorPeriod, metric, priorCutoffMonthDay)
    : 0;
  const currentChange = priorTotal > 0 ? Math.round(((currentTotal - priorTotal) / priorTotal) * 100) : 0;

  const priorPriorPeriod = priorPeriod ? derivePriorPeriod(priorPeriod) : null;
  const priorPriorCutoffMonthDay =
    priorPeriod && priorPriorPeriod ? getComparisonCutoffMonthDay(metrics, priorPeriod, priorPriorPeriod) : null;
  const priorPriorTotal = priorPriorPeriod
    ? getMetricTotalForCampusesPeriod(metrics, campuses, priorPriorPeriod, metric, priorPriorCutoffMonthDay)
    : 0;
  const priorChange =
    priorTotal > 0 && priorPriorTotal > 0
      ? Math.round(((priorTotal - priorPriorTotal) / priorPriorTotal) * 100)
      : null;
  const acceleration = priorChange === null ? null : currentChange - priorChange;

  const historicalBaseline = getHistoricalComparableAverage(metrics, campuses, period, metric);
  const seasonalDelta =
    historicalBaseline && historicalBaseline > 0
      ? Math.round(((currentTotal - historicalBaseline) / historicalBaseline) * 100)
      : null;

  return {
    currentTotal,
    priorTotal,
    priorPeriod,
    currentChange,
    priorPriorTotal,
    priorPriorPeriod,
    priorChange,
    acceleration,
    historicalBaseline,
    seasonalDelta,
  };
}

function getHistoricalComparableAverage(
  metrics: SundayMetric[],
  campuses: string[],
  period: Period,
  metric: KpiKey,
): number | null {
  const currentYear = Number(period.year);
  if (Number.isNaN(currentYear)) return null;

  const historicalYears = getAvailableYears(metrics)
    .map((year) => Number(year))
    .filter((year) => Number.isFinite(year) && year < currentYear)
    .sort((left, right) => left - right);

  const totals = historicalYears.map((year) => {
    const historicalPeriod = replacePeriodYear(period, String(year));
    const cutoffMonthDay = getComparisonCutoffMonthDay(metrics, period, historicalPeriod);
    return getMetricTotalForCampusesPeriod(metrics, campuses, historicalPeriod, metric, cutoffMonthDay);
  }).filter((total) => total > 0);

  if (totals.length === 0) return null;
  return Math.round(avgNumber(totals));
}

function getLifecycleStage(metrics: SundayMetric[], campus: string, referenceYear: number): LifecycleStage {
  const firstYear = metrics
    .filter((metric) => metric.campus === campus)
    .map((metric) => Number(metric.service_date.slice(0, 4)))
    .filter((year) => Number.isFinite(year))
    .sort((left, right) => left - right)[0];

  if (!firstYear) {
    return "Mature / 3+ years";
  }

  const activeYears = Math.max(referenceYear - firstYear + 1, 1);
  if (activeYears <= 1) return "Launch / Year 1";
  if (activeYears <= 3) return "Stabilizing / Years 2-3";
  return "Mature / 3+ years";
}

function classifyGrowthVerdict({
  currentChange,
  acceleration,
  seasonalDelta,
  volatility,
  volunteerRatio,
  kidsRatio,
  ftgRate,
}: {
  currentChange: number;
  acceleration: number | null;
  seasonalDelta: number | null;
  volatility: number;
  volunteerRatio: number | null;
  kidsRatio: number | null;
  ftgRate: number | null;
}) {
  let score = 0;

  if (currentChange >= churchGrowthBenchmarks.yoyAttendanceGrowthTarget * 100) score += 3;
  else if (currentChange >= 8) score += 2;
  else if (currentChange >= 2) score += 1;
  else if (currentChange <= -10) score -= 3;
  else if (currentChange <= -8) score -= 2;
  else if (currentChange <= -2) score -= 1;

  if (acceleration !== null) {
    if (acceleration >= 5) score += 1;
    else if (acceleration <= -5) score -= 1;
  }

  if (seasonalDelta !== null) {
    if (seasonalDelta >= 5) score += 1;
    else if (seasonalDelta <= -5) score -= 1;
  }

  if (volatility >= 18) score -= 1;
  if (volunteerRatio !== null && volunteerRatio > 0 && volunteerRatio < churchGrowthBenchmarks.weeklyVolunteerCoverageWatch) score -= 1;
  if (kidsRatio !== null && kidsRatio > 0 && (kidsRatio < churchGrowthBenchmarks.kidsRatioMin * 0.8 || kidsRatio > churchGrowthBenchmarks.kidsRatioMax * 1.15)) score -= 1;
  if (ftgRate !== null && ftgRate > 0 && ftgRate < churchGrowthBenchmarks.firstTimeGuestRateMin) score -= 1;

  const verdict: GrowthVerdict =
    score >= 3 ? "Strong" : score >= 1 ? "Healthy" : score <= -3 ? "Critical" : "Watch";

  const reasonParts = [
    currentChange >= 8
      ? currentChange >= churchGrowthBenchmarks.yoyAttendanceGrowthTarget * 100
        ? "reach is meeting or exceeding the 20% year-over-year growth target"
        : "reach is clearly above the prior baseline"
      : currentChange <= -8
        ? "reach is materially below the prior baseline"
        : "reach is present but not decisive",
    acceleration !== null
      ? acceleration >= 5
        ? "growth speed is improving"
        : acceleration <= -5
          ? "growth speed is slowing"
          : "growth speed is stable"
      : "growth speed is not yet measurable",
    seasonalDelta !== null
      ? seasonalDelta >= 5
        ? "the campus is outperforming seasonal norms"
        : seasonalDelta <= -5
          ? "the campus is under seasonal norms"
          : "seasonal performance is close to normal"
      : "seasonal history is limited",
    volatility >= 18 ? "week-to-week volatility is elevated" : "execution consistency is acceptable",
    volunteerRatio !== null && volunteerRatio > 0 && volunteerRatio < churchGrowthBenchmarks.weeklyVolunteerCoverageWatch
      ? "capacity is thin because weekly volunteer coverage is below the watch line"
      : null,
    kidsRatio !== null && kidsRatio > 0 && kidsRatio > churchGrowthBenchmarks.kidsRatioMax * 1.15
      ? "kids ministry demand is above the 20-25% family-health range and should be capacity-checked"
      : null,
    ftgRate !== null && ftgRate > 0 && ftgRate < churchGrowthBenchmarks.firstTimeGuestRateMin
      ? "connection is soft because first-time guest flow is below the 2-4% target range"
      : null,
  ].filter(Boolean);

  return {
    verdict,
    reason: `${reasonParts[0]}. ${reasonParts.slice(1).join(". ")}.`,
  };
}

function buildScorecardCaveat(
  performance: PeriodPerformanceSummary,
  transitions: TransitionContextEvent[],
) {
  const caveats: string[] = [];

  if (performance.priorChange === null) {
    caveats.push("Growth speed is based on one comparison layer only because earlier history is limited.");
  }

  if (performance.historicalBaseline === null) {
    caveats.push("Seasonal baseline is thin, so the low-season read is directional rather than definitive.");
  }

  if (transitions.length === 0) {
    caveats.push("No campus pastor or staff transitions are logged for this window yet.");
  }

  caveats.push("Volunteer health is using weekly serving counts as a proxy; the 40% roster benchmark needs roster-level Planning Center data before it can be scored directly.");

  return caveats.join(" ");
}

function getTransitionContextEvents(
  metrics: SundayMetric[],
  campuses: string[],
  period: Period,
  comparison?: Period,
): TransitionContextEvent[] {
  const range = getPeriodContextRange(metrics, period, comparison);
  const seen = new Set<string>();

  return metrics
    .filter((metric) => campuses.includes(metric.campus) && metric.notes.trim() !== "")
    .flatMap((metric) => {
      if (metric.service_date < range.windowStart || metric.service_date > range.windowEnd) {
        return [];
      }

      const transitionType = inferTransitionType(metric.notes);
      if (!transitionType) {
        return [];
      }

      const key = `${metric.campus}|${metric.service_date}|${metric.notes.trim().toLowerCase()}`;
      if (seen.has(key)) return [];
      seen.add(key);

      return [{
        campus: metric.campus,
        date: metric.service_date,
        type: transitionType,
        note: metric.notes.trim(),
        timing: metric.service_date < range.periodStart ? "Preceded scope" : "Within scope",
      } satisfies TransitionContextEvent];
    })
    .sort((left, right) => left.date.localeCompare(right.date));
}

function inferTransitionType(note: string): TransitionContextEvent["type"] | null {
  const normalized = note.toLowerCase();

  if (normalized.includes("campus pastor") || normalized.includes("new cp") || normalized.includes("cp transition")) {
    return "Campus Pastor Change";
  }

  if (normalized.includes("leadership") || normalized.includes("executive pastor") || normalized.includes("staff transition")) {
    return "Leadership Transition";
  }

  if (normalized.includes("new staff") || normalized.includes("staff change") || normalized.includes("new director") || normalized.includes("new worship")) {
    return "Staff Transition";
  }

  return null;
}

function getPeriodContextRange(metrics: SundayMetric[], period: Period, comparison?: Period) {
  const periodStart = getPeriodStartDate(period);
  const latestDate = getLatestDateWithinPeriod(metrics, period);
  const periodEnd = latestDate ?? getPeriodEndDate(period);
  const windowStart = offsetIsoDate(periodStart, -90);
  const comparisonStart = comparison ? getPeriodStartDate(comparison) : null;

  return {
    periodStart,
    periodEnd,
    windowStart: comparisonStart && comparisonStart < windowStart ? comparisonStart : windowStart,
    windowEnd: periodEnd,
  };
}

function getPeriodStartDate(period: Period) {
  const month = period.month
    ? period.month
    : period.quarter
      ? (period.quarter - 1) * 3 + 1
      : 1;

  return `${period.year}-${String(month).padStart(2, "0")}-01`;
}

function getPeriodEndDate(period: Period) {
  if (period.month) {
    return `${period.year}-${String(period.month).padStart(2, "0")}-31`;
  }

  if (period.quarter) {
    const month = period.quarter * 3;
    return `${period.year}-${String(month).padStart(2, "0")}-31`;
  }

  return `${period.year}-12-31`;
}

function offsetIsoDate(isoDate: string, days: number) {
  const next = new Date(`${isoDate}T00:00:00`);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

function replacePeriodYear(period: Period, year: string): Period {
  return {
    year,
    quarter: period.quarter,
    month: period.month,
  };
}

function buildExecutiveBrief(
  metrics: SundayMetric[],
  filters: ComparisonFilters,
  campuses: string[],
): ExecutiveBrief | null {
  if (campuses.length === 0) return null;

  const performance = summarizePeriodPerformance(metrics, campuses, filters.periodA, filters.metric, filters.periodB);
  const scorecard = buildExecutiveScorecard(metrics, filters, campuses);
  const metricLabel = getMetricLabel(filters.metric).toLowerCase();
  const periodAData = performance.currentTotal;
  const priorPeriod = performance.priorPeriod;
  const priorLabel = priorPeriod ? formatPeriodShort(priorPeriod) : null;
  const priorData = performance.priorTotal;
  const periodChange = performance.currentChange;
  const priorCutoffMonthDay = priorPeriod ? getComparisonCutoffMonthDay(metrics, filters.periodA, priorPeriod) : null;
  const growthSpeed = scorecard?.acceleration ?? null;
  const seasonalDelta = scorecard?.seasonalDelta ?? null;
  const dataset = getComparisonDatasetFromMetrics(metrics, { ...filters, selectedCampuses: campuses });
  const nonEmpty = dataset.filter((point) => point.total > 0);
  const firstPoint = nonEmpty[0];
  const lastPoint = nonEmpty[nonEmpty.length - 1];
  const trendPct = firstPoint && lastPoint && firstPoint.total > 0
    ? Math.round(((lastPoint.total - firstPoint.total) / firstPoint.total) * 100)
    : 0;
  const diagnosticRead = buildDiagnosticFindings(metrics, filters, campuses)[0] ?? null;

  if (campuses.length === 1) {
    const campus = campuses[0];
    const profile = buildCampusProfile(metrics, campus, filters.periodA, filters.periodB);
    if (!profile) return null;
    const volatility = calculateCampusVolatility(dataset, campus);
    const tone: ExecutiveBrief["tone"] =
      periodChange <= -5 || trendPct <= -5 ? "warning" : periodChange >= 5 || trendPct >= 5 ? "positive" : "neutral";
    const headline =
      tone === "warning"
        ? `${campus} is under its recent baseline`
        : tone === "positive"
          ? `${campus} is outperforming its recent baseline`
          : `${campus} is holding near baseline`;

    const summaryParts = [
      `${campus} produced ${periodAData.toLocaleString()} ${metricLabel} in ${formatPeriodShort(filters.periodA)}.`,
      priorLabel && priorData > 0
        ? `That is ${periodChange > 0 ? "up" : periodChange < 0 ? "down" : "flat"} ${Math.abs(periodChange)}% versus ${priorLabel}.`
        : `A comparable prior baseline was not available, so the read leans more heavily on the period trend itself.`,
      growthSpeed !== null
        ? `Compared with the prior comparison cycle, growth speed is ${growthSpeed > 2 ? "accelerating" : growthSpeed < -2 ? "slowing" : "holding roughly steady"}.`
        : null,
      firstPoint && lastPoint
        ? `Within the selected period, the campus moved from ${firstPoint.total.toLocaleString()} in ${firstPoint.label} to ${lastPoint.total.toLocaleString()} in ${lastPoint.label} (${trendPct > 0 ? "+" : ""}${trendPct}%).`
        : null,
      seasonalDelta !== null
        ? `Against the same seasonal window in older years, this campus is ${seasonalDelta > 0 ? "running above" : seasonalDelta < 0 ? "running below" : "tracking in line with"} baseline by ${Math.abs(seasonalDelta)}%.`
        : null,
      diagnosticRead ? `Diagnostic read: ${diagnosticRead.detail}` : null,
      `Research lens: reach is judged against the campus's own prior baseline, connection is judged by first-time guest and Growth Track movement, and capacity is judged by weekly volunteer and kids pressure.`,
      profile.growthTrackComparable
        ? `Volunteer coverage is ${formatRatio(profile.volunteerRatio)} and guest-to-Growth-Track next-step conversion is ${(profile.growthTrackRate * 100).toFixed(1)}%.`
        : `Volunteer coverage is ${formatRatio(profile.volunteerRatio)}. Growth Track volume is higher than first-time guest volume in this period, so it should be read as broader next-step activity rather than a direct guest conversion rate.`,
      volatility > 12
        ? `Week-to-week volatility is elevated, which means execution consistency matters as much as topline growth right now.`
        : `Week-to-week volatility is reasonably controlled, so the story is more about steady operating rhythm than random swings.`,
    ].filter(Boolean);

    return {
      headline,
      summary: summaryParts.join(" "),
      tone,
    };
  }

  const comparisonRows = campuses.map((campus) => {
    const current = getMetricTotalForCampusPeriod(metrics, campus, filters.periodA, filters.metric);
    const prior = priorPeriod
      ? getMetricTotalForCampusPeriod(metrics, campus, priorPeriod, filters.metric, priorCutoffMonthDay)
      : 0;
    const change = prior > 0 ? Math.round(((current - prior) / prior) * 100) : 0;
    return { campus, current, prior, change };
  }).sort((a, b) => b.change - a.change);

  const top = comparisonRows[0];
  const bottom = comparisonRows[comparisonRows.length - 1];
  const topShare = periodAData > 0 ? top.current / periodAData : 0;
  const tone: ExecutiveBrief["tone"] =
    periodChange <= -5 || (bottom && bottom.change <= -8) ? "warning" : periodChange >= 5 ? "positive" : "neutral";
  const headline =
    tone === "warning"
      ? `Selected campuses need attention on execution consistency`
      : tone === "positive"
        ? `Selected campuses are trending in the right direction`
        : `Selected campuses are stable, with mixed momentum underneath`;

  const summaryParts = [
    `${campuses.join(", ")} produced ${periodAData.toLocaleString()} ${metricLabel} in ${formatPeriodShort(filters.periodA)}.`,
    priorLabel && priorData > 0
      ? `That is ${periodChange > 0 ? "up" : periodChange < 0 ? "down" : "flat"} ${Math.abs(periodChange)}% versus ${priorLabel}.`
      : null,
    growthSpeed !== null
      ? `Portfolio growth speed is ${growthSpeed > 2 ? "accelerating" : growthSpeed < -2 ? "slowing" : "holding steady"} relative to the prior cycle.`
      : null,
    top && bottom
      ? `${top.campus} is the strongest mover (${top.change > 0 ? "+" : ""}${top.change}%), while ${bottom.campus} is the weakest (${bottom.change > 0 ? "+" : ""}${bottom.change}%).`
      : null,
    seasonalDelta !== null
      ? `Relative to the same seasonal window in older years, the selected scope is ${seasonalDelta > 0 ? "above" : seasonalDelta < 0 ? "below" : "in line with"} baseline by ${Math.abs(seasonalDelta)}%.`
      : null,
    diagnosticRead ? `Diagnostic read: ${diagnosticRead.detail}` : null,
    `The executive read uses three research-backed lenses: Reach (attendance and guest flow), Connection (next steps and response), and Capacity (volunteers, kids, and service load).`,
    topShare > 0.4
      ? `${top.campus} contributes ${Math.round(topShare * 100)}% of the scoped total, so the current performance base is still concentrated.`
      : `No single campus is dominating the scoped total, which reduces concentration risk and makes the trend more structurally balanced.`,
  ].filter(Boolean);

  return {
    headline,
    summary: summaryParts.join(" "),
    tone,
  };
}

function buildExecutiveBriefFromLatest(health: CampusHealth[], latestDate: string | null): ExecutiveBrief | null {
  if (health.length === 0) return null;
  const leader = health[0];
  return {
    headline: `Latest Sunday snapshot is led by ${leader.campus}`,
    summary: `${leader.campus} posted ${leader.attendance.toLocaleString()} attendance${latestDate ? ` on ${formatShortDateLabel(latestDate)}` : ""}. This default summary is based on the latest Sunday only; deeper executive analysis becomes more decision-useful once a dashboard comparison scope is selected.`,
    tone: "neutral",
  };
}

function buildExecutiveFindings(
  metrics: SundayMetric[],
  filters: ComparisonFilters,
  campuses: string[],
): ExecutiveFinding[] {
  if (campuses.length === 0) return [];

  const diagnosticFindings = buildDiagnosticFindings(metrics, filters, campuses);
  const opportunities = buildOpportunities(metrics, { ...filters, selectedCampuses: campuses });
  const mapped = opportunities.slice(0, 3).map((opportunity) => ({
    title: opportunity.title,
    detail: `${opportunity.insight} Recommended next move: ${opportunity.action}`,
    tone:
      opportunity.severity === "positive"
        ? "positive"
        : opportunity.severity === "high" || opportunity.severity === "medium"
          ? "warning"
          : "neutral",
    lens: getOpportunityLens(opportunity),
  } satisfies ExecutiveFinding));

  if (diagnosticFindings.length > 0 || mapped.length > 0) {
    const combined = [...diagnosticFindings, ...mapped];
    const seenTitles = new Set<string>();
    return combined.filter((finding) => {
      if (seenTitles.has(finding.title)) return false;
      seenTitles.add(finding.title);
      return true;
    }).slice(0, 4);
  }

  const metricLabel = getMetricLabel(filters.metric).toLowerCase();
  const currentTotal = getMetricTotalForCampusesPeriod(metrics, campuses, filters.periodA, filters.metric);
  const priorPeriod = filters.periodB ?? derivePriorPeriod(filters.periodA);
  const priorCutoffMonthDay = priorPeriod ? getComparisonCutoffMonthDay(metrics, filters.periodA, priorPeriod) : null;
  const priorTotal = priorPeriod
    ? getMetricTotalForCampusesPeriod(metrics, campuses, priorPeriod, filters.metric, priorCutoffMonthDay)
    : 0;
  const change = priorTotal > 0 ? Math.round(((currentTotal - priorTotal) / priorTotal) * 100) : 0;

  return [{
    title: "Period-over-period read",
    detail: priorTotal > 0
      ? `The selected scope is at ${currentTotal.toLocaleString()} ${metricLabel} versus ${priorTotal.toLocaleString()} in ${formatPeriodShort(priorPeriod!)} (${change > 0 ? "+" : ""}${change}%). With no stronger anomaly or funnel break present, the main leadership question is whether that change is durable and operationally supported.`
      : `The selected scope is at ${currentTotal.toLocaleString()} ${metricLabel}. A prior comparable baseline was not available, so the immediate next step is to establish the right historical benchmark before over-interpreting the current number.`,
    tone: change >= 5 ? "positive" : change <= -5 ? "warning" : "neutral",
    lens: "Reach",
  }];
}

function buildDiagnosticFindings(
  metrics: SundayMetric[],
  filters: ComparisonFilters,
  campuses: string[],
): DiagnosticFinding[] {
  return campuses
    .map((campus) => buildCampusDiagnosticFinding(metrics, filters, campus))
    .filter((finding): finding is DiagnosticFinding => finding !== null)
    .sort((left, right) => {
      const toneWeight = (finding: DiagnosticFinding) => finding.tone === "warning" ? 2 : finding.tone === "neutral" ? 1 : 0;
      const toneDiff = toneWeight(right) - toneWeight(left);
      if (toneDiff !== 0) return toneDiff;
      return right.priorityScore - left.priorityScore;
    })
    .slice(0, campuses.length === 1 ? 1 : 2);
}

function buildExecutiveActionCards(
  metrics: SundayMetric[],
  filters: ComparisonFilters,
  campuses: string[],
): ExecutiveActionCard[] {
  return campuses
    .map((campus) => buildCampusExecutiveActionCard(metrics, filters, campus))
    .filter((card): card is ExecutiveActionCard => card !== null)
    .sort((left, right) => {
      const urgencyRank: Record<ExecutiveActionCard["urgency"], number> = {
        "Decide now": 0,
        "This week": 1,
        Monitor: 2,
      };
      return urgencyRank[left.urgency] - urgencyRank[right.urgency];
    })
    .slice(0, campuses.length === 1 ? 2 : 4);
}

function buildCampusExecutiveActionCard(
  metrics: SundayMetric[],
  filters: ComparisonFilters,
  campus: string,
): ExecutiveActionCard | null {
  const profile = buildCampusProfile(metrics, campus, filters.periodA, filters.periodB);
  if (!profile) return null;

  const performance = summarizePeriodPerformance(metrics, [campus], filters.periodA, filters.metric, filters.periodB);
  const transitions = getTransitionContextEvents(metrics, [campus], filters.periodA, filters.periodB);
  const diagnosis = classifyDiagnosticPressure(profile, performance, transitions.length > 0);
  const concentration = describeChangeConcentration(metrics, campus, filters, performance.priorPeriod);
  const priorLabel = performance.priorPeriod ? formatPeriodShort(performance.priorPeriod) : "prior comparable period";
  const urgency = getActionUrgency(diagnosis.lens, diagnosis.tone, performance.currentChange, profile);
  const evidence = [
    `${formatPeriodShort(filters.periodA)} is ${formatDirectionalChange(performance.currentChange)} versus ${priorLabel}.`,
    performance.acceleration !== null ? `Growth speed is ${formatSignedNumber(performance.acceleration)} pts versus the prior cycle.` : null,
    performance.seasonalDelta !== null ? `Seasonal baseline is ${formatSignedWholePercent(performance.seasonalDelta)} versus older comparable windows.` : null,
    concentration?.sentence,
    profile.volunteerRatio > 0 ? `Weekly volunteer coverage is ${formatRatio(profile.volunteerRatio)}.` : null,
    profile.kidsRatio > 0 ? `Kids ratio is ${formatRatio(profile.kidsRatio)}.` : null,
    profile.ftgRate > 0 ? `First-time guest rate is ${formatRatio(profile.ftgRate)}.` : null,
    profile.growthTrackComparable && profile.firstTimeGuests > 0
      ? `Directional guest-to-Growth-Track rate is ${(profile.growthTrackRate * 100).toFixed(1)}%.`
      : profile.growthTrack > profile.firstTimeGuests && profile.firstTimeGuests > 0
        ? `Growth Track exceeds first-time guest volume, so it cannot be treated as literal guest conversion.`
        : null,
    transitions[0] ? `${transitions[0].type} context exists: ${transitions[0].note}` : null,
  ].filter((item): item is string => Boolean(item));

  return {
    campus,
    lens: diagnosis.lens,
    urgency,
    title: buildActionTitle(campus, diagnosis.lens),
    diagnosis: buildActionDiagnosis(campus, diagnosis, profile, performance),
    hypothesis: buildActionHypothesis(campus, diagnosis.lens, profile, performance, concentration, transitions.length > 0),
    evidence: evidence.slice(0, 5),
    decision: buildActionDecision(campus, diagnosis.lens),
    nextMove: buildActionNextMove(campus, diagnosis.lens),
    dataToConfirm: buildActionDataNeeds(diagnosis.lens),
  };
}

function getActionUrgency(
  lens: ExecutiveReportLens,
  tone: ExecutiveFinding["tone"],
  currentChange: number,
  profile: CampusProfile,
): ExecutiveActionCard["urgency"] {
  if (
    tone === "warning" &&
    (currentChange <= -8 ||
      lens === "Capacity" ||
      (profile.volunteerRatio > 0 && profile.volunteerRatio < churchGrowthBenchmarks.weeklyVolunteerCoverageWatch))
  ) {
    return "Decide now";
  }

  if (tone === "warning" || lens === "Connection" || lens === "Seasonality") {
    return "This week";
  }

  return "Monitor";
}

function buildActionTitle(campus: string, lens: ExecutiveReportLens) {
  switch (lens) {
    case "Capacity":
      return `${campus}: protect service capacity before pushing growth`;
    case "Connection":
      return `${campus}: tighten the next-step pathway`;
    case "Reach":
      return `${campus}: rebuild reach momentum`;
    case "Seasonality":
      return `${campus}: prepare a low-season countermeasure`;
    case "Leadership Context":
      return `${campus}: interpret the trend through leadership change`;
    case "Replication":
      return `${campus}: document what is working`;
    default:
      return `${campus}: improve data confidence before major decisions`;
  }
}

function buildActionDiagnosis(
  campus: string,
  diagnosis: ReturnType<typeof classifyDiagnosticPressure>,
  profile: CampusProfile,
  performance: PeriodPerformanceSummary,
) {
  const movement = formatDirectionalChange(performance.currentChange);

  switch (diagnosis.lens) {
    case "Capacity":
      return `${campus} is ${movement}, but the more useful leadership read is whether the campus can carry the current load. Volunteer coverage, kids demand, and service execution should be treated as the operating constraint.`;
    case "Connection":
      return `${campus} is ${movement}, and the concern is not just attendance. The report is pointing to a pathway issue: response, Growth Track, or follow-up may not be converting people into durable engagement.`;
    case "Reach":
      return `${campus} is ${movement}, and the strongest current signal is top-of-funnel softness. Attendance and first-time guest flow need a focused reach response before assuming the issue is internal operations.`;
    case "Seasonality":
      return `${campus} is ${movement}, and the selected window is under historical rhythm. Treat this as a seasonal-performance problem unless upcoming context proves it is structural.`;
    case "Leadership Context":
      return `${campus} is ${movement}, but the trend should be read through known transition context before assigning the cause to programming, outreach, or execution.`;
    case "Replication":
      return `${campus} is ${movement} with no obvious capacity or connection warning. The question is not whether it is good; it is what practice should be preserved and transferred.`;
    default:
      return `${campus} is ${movement}. The current metrics are not enough to name a strong cause; add context and cohort data before making a major operating call. ${profile.attendance.toLocaleString()} attendance is the base for this read.`;
  }
}

function buildActionHypothesis(
  campus: string,
  lens: ExecutiveReportLens,
  profile: CampusProfile,
  performance: PeriodPerformanceSummary,
  concentration: ChangeConcentration | null,
  hasTransitionContext: boolean,
) {
  const movement = formatDirectionalChange(performance.currentChange);
  const concentrationRead = concentration?.sentence ? ` ${concentration.sentence}` : "";

  switch (lens) {
    case "Capacity": {
      const volunteerSignal =
        profile.volunteerRatio > 0 && profile.volunteerRatio < churchGrowthBenchmarks.weeklyVolunteerCoverageWatch
          ? `volunteer coverage is under the operating watch line at ${formatRatio(profile.volunteerRatio)}`
          : `kids/service load is the clearest pressure point`;
      return `Working theory: ${campus} is ${movement}, but the constraint may be capacity more than demand because ${volunteerSignal}.${concentrationRead} Before funding more reach, confirm whether Sunday teams can preserve experience quality at the current load.`;
    }
    case "Connection": {
      const growthTrackRead =
        profile.growthTrackComparable && profile.firstTimeGuests > 0
          ? `Growth Track activity is ${(profile.growthTrackRate * 100).toFixed(1)}% of first-time guest volume`
          : profile.growthTrack > profile.firstTimeGuests && profile.firstTimeGuests > 0
            ? `Growth Track volume exceeds first-time guest volume, so it should be read as broader discipleship activity, not literal guest conversion`
            : `next-step conversion needs cohort-level confirmation`;
      return `Working theory: ${campus} may have a pathway issue more than a pure attendance issue. ${growthTrackRead}; the next question is whether people are being followed up quickly, invited clearly, and handed from Sunday attendance into Growth Track, baptism, serving, or groups.`;
    }
    case "Reach":
      return `Working theory: ${campus} needs more top-of-funnel pressure. The read is ${movement}, and first-time guest flow is ${profile.ftgRate > 0 ? formatRatio(profile.ftgRate) : "not yet visible"} of attendance, so the immediate test is whether invitation, outreach, events, or service-time promotion can create new guest volume.${concentrationRead}`;
    case "Seasonality":
      return `Working theory: this may be a predictable seasonal or event-cycle pattern rather than a structural decline. Compare this window to the same weeks across the last three years, especially around Big 5 Sundays, school calendars, and post-event falloff, before assigning blame to campus execution.`;
    case "Leadership Context":
      return `Working theory: the numbers need to be interpreted through transition context. ${hasTransitionContext ? "A leadership or staff transition is already logged" : "A transition may not be logged yet"}, so the next read should compare pre-transition, transition, and stabilization windows before setting performance expectations.`;
    case "Replication":
      return `Working theory: ${campus} is showing transferable strength, not just statistical noise. The task is to identify which practices created durable momentum and which ones depend on local leadership, event timing, or campus-specific conditions.`;
    default:
      return `Working theory: the current dataset is directionally useful but not causal. Add cohort, service-time, staff-transition, and ministry-owner context before making a major resource decision.`;
  }
}

function buildActionDecision(campus: string, lens: ExecutiveReportLens) {
  switch (lens) {
    case "Capacity":
      return `Decide whether ${campus} should slow promotional pressure until serve teams, kids rooms, and service support are confirmed healthy.`;
    case "Connection":
      return `Decide who owns the next-step funnel at ${campus}: guest follow-up, Growth Track invitation, baptism response, and serve handoff.`;
    case "Reach":
      return `Decide what reach lever ${campus} will use next: invitation series, event promotion, local outreach, or service-time campaign.`;
    case "Seasonality":
      return `Decide whether to accept the seasonal dip or fund a counter-seasonal push with a clear attendance and guest target.`;
    case "Leadership Context":
      return `Decide what transition support ${campus} needs and what performance window should be used before evaluating the new normal.`;
    case "Replication":
      return `Decide which practice from ${campus} is worth documenting and testing elsewhere.`;
    default:
      return `Decide what data must be added before leadership treats this read as causal.`;
  }
}

function buildActionNextMove(campus: string, lens: ExecutiveReportLens) {
  switch (lens) {
    case "Capacity":
      return `Run a 7-day capacity audit by service: volunteer check-ins, kids room load, first-impressions coverage, parking, and auditorium fill.`;
    case "Connection":
      return `Audit the last 25 first-time guests from ${campus}: follow-up timing, second visit, Growth Track invite, Growth Track attendance, and serve/baptism step.`;
    case "Reach":
      return `Build a 4-week reach plan with one measurable hook, one owner, and weekly tracking for attendance, first-time guests, and invite source.`;
    case "Seasonality":
      return `Map this window against the last three years, school calendars, Big 5 events, and sermon series so the team knows what dip is normal.`;
    case "Leadership Context":
      return `Create a transition note: what changed, when it changed, expected stabilization window, and what support the campus needs.`;
    case "Replication":
      return `Interview the campus lead and two ministry owners this week; capture the repeatable behaviors behind the trend.`;
    default:
      return `Add missing context notes and cohort fields before the next executive review.`;
  }
}

function buildActionDataNeeds(lens: ExecutiveReportLens) {
  switch (lens) {
    case "Capacity":
      return ["Volunteer roster by team/service", "Weekly serve check-ins", "Kids room capacity", "Service fill rate"];
    case "Connection":
      return ["First-time guest follow-up status", "Second-visit date", "Growth Track signup/completion", "Baptism and serve handoff"];
    case "Reach":
      return ["Invite source", "Campaign/event calendar", "Local outreach dates", "Service-time attendance trend"];
    case "Seasonality":
      return ["Three-year same-week baseline", "Big 5 event windows", "School/holiday calendar", "Weather or cancellation notes"];
    case "Leadership Context":
      return ["Campus pastor/staff transition log", "Pre/post transition window", "Coverage plan", "Known morale or staffing risks"];
    case "Replication":
      return ["Ministry practice notes", "Volunteer onboarding cadence", "Guest follow-up workflow", "Event or series strategy"];
    default:
      return ["Context notes", "Person-level cohorts", "Ministry owner annotations", "Data quality review"];
  }
}

function buildCampusDiagnosticFinding(
  metrics: SundayMetric[],
  filters: ComparisonFilters,
  campus: string,
): DiagnosticFinding | null {
  const profile = buildCampusProfile(metrics, campus, filters.periodA, filters.periodB);
  if (!profile) return null;

  const performance = summarizePeriodPerformance(metrics, [campus], filters.periodA, filters.metric, filters.periodB);
  const priorLabel = performance.priorPeriod ? formatPeriodShort(performance.priorPeriod) : "the prior comparable period";
  const metricLabel = getMetricLabel(filters.metric).toLowerCase();
  const concentration = describeChangeConcentration(metrics, campus, filters, performance.priorPeriod);
  const transitions = getTransitionContextEvents(metrics, [campus], filters.periodA, filters.periodB);
  const diagnosis = classifyDiagnosticPressure(profile, performance, transitions.length > 0);
  const issueLabel = diagnosis.lens.toLowerCase();

  const parts = [
    `${campus} is ${formatDirectionalChange(performance.currentChange)} versus ${priorLabel} for ${metricLabel}.`,
    concentration?.sentence,
    buildCapacityDiagnosticSentence(profile),
    buildConnectionDiagnosticSentence(profile),
    buildReachDiagnosticSentence(profile),
    transitions.length > 0
      ? `${transitions[0].type} is logged ${transitions[0].timing.toLowerCase()} on ${formatShortDateLabel(transitions[0].date)}, so this read should be reviewed against that leadership context.`
      : null,
    `This points ${diagnosis.certainty} to a ${issueLabel} issue: ${diagnosis.reason}`,
  ].filter(Boolean);

  return {
    title: `${campus} diagnostic read`,
    detail: parts.join(" "),
    tone: diagnosis.tone,
    lens: diagnosis.lens,
    priorityScore: Math.abs(performance.currentChange) + diagnosis.priorityBoost + (concentration?.priorityBoost ?? 0),
  };
}

function classifyDiagnosticPressure(
  profile: CampusProfile,
  performance: PeriodPerformanceSummary,
  hasTransitionContext: boolean,
): { lens: ExecutiveReportLens; tone: ExecutiveFinding["tone"]; reason: string; certainty: "most strongly" | "partly" | "more than"; priorityBoost: number } {
  const capacityPressure =
    (profile.volunteerRatio > 0 && profile.volunteerRatio < churchGrowthBenchmarks.weeklyVolunteerCoverageWatch) ||
    (profile.kidsRatio > 0 && profile.kidsRatio > churchGrowthBenchmarks.kidsRatioMax * 1.15);
  const connectionPressure =
    (profile.growthTrackComparable && profile.firstTimeGuests >= 20 && profile.growthTrackRate < 0.2) ||
    profile.salvationGrowth < -5;
  const reachPressure =
    performance.currentChange <= -5 ||
    (profile.ftgRate > 0 && profile.ftgRate < churchGrowthBenchmarks.firstTimeGuestRateMin);

  if (capacityPressure) {
    return {
      lens: "Capacity",
      tone: "warning",
      reason: "attendance movement should not be interpreted apart from serving depth, kids load, and service-execution pressure.",
      certainty: connectionPressure || reachPressure ? "more than" : "most strongly",
      priorityBoost: 18,
    };
  }

  if (connectionPressure) {
    return {
      lens: "Connection",
      tone: "warning",
      reason: "people may be present or visiting, but the pathway into response, Growth Track, or next steps is not keeping pace.",
      certainty: reachPressure ? "more than" : "most strongly",
      priorityBoost: 16,
    };
  }

  if (performance.seasonalDelta !== null && performance.seasonalDelta <= -5) {
    return {
      lens: "Seasonality",
      tone: "warning",
      reason: "the selected window is under its own historical seasonal rhythm, so the next question is whether this is a predictable low-season dip or an avoidable execution miss.",
      certainty: reachPressure ? "partly" : "most strongly",
      priorityBoost: 12,
    };
  }

  if (reachPressure) {
    return {
      lens: "Reach",
      tone: "warning",
      reason: "attendance and/or first-time guest flow is softer than the campus's own baseline, before the data shows a clearer connection or capacity bottleneck.",
      certainty: "most strongly",
      priorityBoost: 14,
    };
  }

  if (hasTransitionContext) {
    return {
      lens: "Leadership Context",
      tone: "neutral",
      reason: "the numbers are not flashing a hard operational warning, but leadership changes should be used to interpret the slope and volatility.",
      certainty: "partly",
      priorityBoost: 6,
    };
  }

  return {
    lens: performance.currentChange >= 5 ? "Replication" : "Data Quality",
    tone: performance.currentChange >= 5 ? "positive" : "neutral",
    reason: performance.currentChange >= 5
      ? "the campus is above its own baseline without an obvious capacity or connection warning, so the practical question is what should be preserved and replicated."
      : "the core data is stable enough that deeper explanation will require context notes, cohort data, and ministry-specific inputs.",
    certainty: "partly",
    priorityBoost: performance.currentChange >= 5 ? 8 : 2,
  };
}

function buildCapacityDiagnosticSentence(profile: CampusProfile): string {
  const sentences: string[] = [];

  if (profile.volunteerRatio > 0) {
    const volunteerStatus =
      profile.volunteerRatio < churchGrowthBenchmarks.weeklyVolunteerCoverageWatch
        ? `below the ${formatRatio(churchGrowthBenchmarks.weeklyVolunteerCoverageWatch)} watch line`
        : profile.volunteerRatio < churchGrowthBenchmarks.weeklyVolunteerCoverageHealthy
          ? `between the watch line and the ${formatRatio(churchGrowthBenchmarks.weeklyVolunteerCoverageHealthy)} healthy line`
          : `above the ${formatRatio(churchGrowthBenchmarks.weeklyVolunteerCoverageHealthy)} healthy line`;
    sentences.push(`Weekly volunteer coverage is ${formatRatio(profile.volunteerRatio)}, ${volunteerStatus}.`);
  }

  if (profile.kidsRatio > 0) {
    const kidsStatus =
      profile.kidsRatio >= churchGrowthBenchmarks.kidsRatioMin && profile.kidsRatio <= churchGrowthBenchmarks.kidsRatioMax
        ? "inside"
        : "outside";
    sentences.push(`Kids are ${formatRatio(profile.kidsRatio)} of attendance, ${kidsStatus} the ${formatRatio(churchGrowthBenchmarks.kidsRatioMin)}-${formatRatio(churchGrowthBenchmarks.kidsRatioMax)} family-health range.`);
  }

  return sentences.join(" ");
}

function buildConnectionDiagnosticSentence(profile: CampusProfile): string | null {
  if (profile.firstTimeGuests <= 0 && profile.salvations <= 0 && profile.growthTrack <= 0) {
    return null;
  }

  const parts = [
    profile.firstTimeGuests > 0
      ? `First-time guests are ${formatRatio(profile.ftgRate)} of attendance`
      : null,
    profile.growthTrackComparable && profile.firstTimeGuests > 0
      ? `Growth Track is running at a directional ${(profile.growthTrackRate * 100).toFixed(1)}% of first-time guest volume`
      : profile.growthTrack > profile.firstTimeGuests && profile.firstTimeGuests > 0
        ? `Growth Track exceeds first-time guest volume, so it should be treated as broader next-step activity rather than literal guest conversion`
        : null,
    profile.salvationGrowth !== 0
      ? `salvations are ${formatPct(profile.salvationGrowth)} versus the comparable period`
      : null,
  ].filter(Boolean);

  return parts.length > 0 ? `${parts.join("; ")}.` : null;
}

function buildReachDiagnosticSentence(profile: CampusProfile): string {
  const ftgStatus =
    profile.ftgRate <= 0
      ? "first-time guest flow is not available in this slice"
      : profile.ftgRate < churchGrowthBenchmarks.firstTimeGuestRateMin
        ? `first-time guest flow is below the ${formatRatio(churchGrowthBenchmarks.firstTimeGuestRateMin)}-${formatRatio(churchGrowthBenchmarks.firstTimeGuestRateMax)} reach range`
        : profile.ftgRate <= churchGrowthBenchmarks.firstTimeGuestRateMax
          ? `first-time guest flow is inside the ${formatRatio(churchGrowthBenchmarks.firstTimeGuestRateMin)}-${formatRatio(churchGrowthBenchmarks.firstTimeGuestRateMax)} reach range`
          : `first-time guest flow is above the ${formatRatio(churchGrowthBenchmarks.firstTimeGuestRateMin)}-${formatRatio(churchGrowthBenchmarks.firstTimeGuestRateMax)} reach range`;

  return `Reach read: attendance is ${formatPct(profile.attendanceGrowth)} versus the comparable period, and ${ftgStatus}.`;
}

type ChangeConcentration = {
  sentence: string;
  priorityBoost: number;
};

function describeChangeConcentration(
  metrics: SundayMetric[],
  campus: string,
  filters: ComparisonFilters,
  priorPeriod: Period | null,
): ChangeConcentration | null {
  if (!priorPeriod) return null;

  const anchor = getMajorEventAnchor(metrics, campus, filters.periodA);
  const splitMonthDay = anchor?.date.slice(5) ?? getMidpointSplitMonthDay(metrics, campus, filters.periodA, filters.metric);
  if (!splitMonthDay) return null;

  const splitLabel = anchor?.label ?? "the midpoint of the selected period";
  const currentBefore = getMetricTotalForCampusPeriodSegment(metrics, campus, filters.periodA, filters.metric, (date) =>
    anchor ? date <= anchor.date : date.slice(5) <= splitMonthDay,
  );
  const currentAfter = getMetricTotalForCampusPeriodSegment(metrics, campus, filters.periodA, filters.metric, (date) =>
    anchor ? date > anchor.date : date.slice(5) > splitMonthDay,
  );
  const priorCutoffMonthDay = getComparisonCutoffMonthDay(metrics, filters.periodA, priorPeriod);
  const priorBefore = getMetricTotalForCampusPeriodSegment(metrics, campus, priorPeriod, filters.metric, (date) =>
    date.slice(5) <= splitMonthDay,
    priorCutoffMonthDay,
  );
  const priorAfter = getMetricTotalForCampusPeriodSegment(metrics, campus, priorPeriod, filters.metric, (date) =>
    date.slice(5) > splitMonthDay,
    priorCutoffMonthDay,
  );

  if (currentBefore <= 0 || priorBefore <= 0 || currentAfter <= 0 || priorAfter <= 0) {
    return null;
  }

  const beforeChange = Math.round(((currentBefore - priorBefore) / priorBefore) * 100);
  const afterChange = Math.round(((currentAfter - priorAfter) / priorAfter) * 100);
  const spread = afterChange - beforeChange;

  if (spread <= -8) {
    return {
      sentence: anchor
        ? `The softness is concentrated after ${splitLabel}: before/through that point is ${formatSignedWholePercent(beforeChange)}, while the post-${splitLabel} window is ${formatSignedWholePercent(afterChange)}.`
        : `The softness is concentrated in the back half of the selected period: the first segment is ${formatSignedWholePercent(beforeChange)}, while the back half is ${formatSignedWholePercent(afterChange)}.`,
      priorityBoost: Math.abs(spread),
    };
  }

  if (spread >= 8) {
    return {
      sentence: anchor
        ? `The trend improved after ${splitLabel}: before/through that point is ${formatSignedWholePercent(beforeChange)}, while the post-${splitLabel} window is ${formatSignedWholePercent(afterChange)}.`
        : `The trend improved in the back half of the selected period: the first segment is ${formatSignedWholePercent(beforeChange)}, while the back half is ${formatSignedWholePercent(afterChange)}.`,
      priorityBoost: Math.round(Math.abs(spread) / 2),
    };
  }

  return {
    sentence: anchor
      ? `The movement is not isolated to ${splitLabel}; before/through that point is ${formatSignedWholePercent(beforeChange)} and the post-${splitLabel} window is ${formatSignedWholePercent(afterChange)}.`
      : `The movement is fairly even across the selected period: the first segment is ${formatSignedWholePercent(beforeChange)} and the back half is ${formatSignedWholePercent(afterChange)}.`,
    priorityBoost: 0,
  };
}

function getMetricTotalForCampusPeriodSegment(
  metrics: SundayMetric[],
  campus: string,
  period: Period,
  metric: KpiKey,
  predicate: (date: string) => boolean,
  cutoffMonthDay?: string | null,
) {
  const field = metricFieldMap[metric];
  return filterMetricsByPeriod(filterMetricsByField(metrics, field), period, cutoffMonthDay)
    .filter((record) => record.campus === campus && predicate(record.service_date))
    .reduce((sum, record) => sum + record[field], 0);
}

function getMajorEventAnchor(metrics: SundayMetric[], campus: string, period: Period): { date: string; label: string } | null {
  const eventCandidates = filterMetricsByPeriod(metrics, period)
    .filter((metric) => metric.campus === campus && metric.notes.trim() !== "")
    .map((metric) => {
      const label = getMajorEventLabel(metric.notes);
      return label ? { date: metric.service_date, label, priority: getMajorEventPriority(label) } : null;
    })
    .filter((event): event is { date: string; label: string; priority: number } => event !== null)
    .sort((left, right) => {
      if (left.priority !== right.priority) return right.priority - left.priority;
      return left.date.localeCompare(right.date);
    });

  if (eventCandidates.length === 0) return null;
  const event = eventCandidates[0];
  return { date: event.date, label: event.label };
}

function getMajorEventLabel(note: string): string | null {
  const normalized = note.toLowerCase();
  if (normalized.includes("easter")) return "Easter";
  if (normalized.includes("good fri") || normalized.includes("good friday")) return "Easter weekend";
  if (normalized.includes("mother")) return "Mother's Day";
  if (normalized.includes("father")) return "Father's Day";
  if (normalized.includes("christmas") || normalized.includes("xmas")) return "Christmas";
  if (normalized.includes("vision")) return "Vision Sunday";
  if (normalized.includes("launch")) return "Launch Sunday";
  if (normalized.includes("baptism")) return "Baptism Sunday";
  return null;
}

function getMajorEventPriority(label: string): number {
  if (label === "Easter") return 7;
  if (label === "Easter weekend") return 6;
  if (label === "Christmas") return 5;
  if (label === "Mother's Day" || label === "Father's Day") return 4;
  if (label === "Vision Sunday" || label === "Launch Sunday") return 3;
  return 1;
}

function getMidpointSplitMonthDay(metrics: SundayMetric[], campus: string, period: Period, metric: KpiKey): string | null {
  const field = metricFieldMap[metric];
  const dates = getUniqueSortedDates(
    filterMetricsByPeriod(filterMetricsByField(metrics, field), period)
      .filter((metricRecord) => metricRecord.campus === campus && metricRecord[field] > 0),
  );
  if (dates.length < 4) return null;
  return dates[Math.floor((dates.length - 1) / 2)].slice(5);
}

function formatDirectionalChange(value: number): string {
  if (value > 0) return `up ${Math.abs(value)}%`;
  if (value < 0) return `down ${Math.abs(value)}%`;
  return "flat";
}

function formatSignedWholePercent(value: number): string {
  return `${value > 0 ? "+" : ""}${value}%`;
}

function formatSignedNumber(value: number): string {
  return `${value > 0 ? "+" : ""}${value}`;
}

function getOpportunityLens(opportunity: Opportunity): ExecutiveReportLens {
  switch (opportunity.category) {
    case "outreach":
      return "Reach";
    case "assimilation-leak":
    case "engagement-gap":
      return "Connection";
    case "volunteer-gap":
    case "kids-strain":
    case "capacity":
      return "Capacity";
    case "seasonal":
      return "Seasonality";
    case "replication":
      return "Replication";
    case "concentration-risk":
      return "Leadership Context";
    default:
      return "Data Quality";
  }
}

function getMetricTotalForCampusesPeriod(
  metrics: SundayMetric[],
  campuses: string[],
  period: Period,
  metric: KpiKey,
  cutoffMonthDay?: string | null,
): number {
  return campuses.reduce((sum, campus) => sum + getMetricTotalForCampusPeriod(metrics, campus, period, metric, cutoffMonthDay), 0);
}

function calculateCampusVolatility(data: ComparisonDatasetPoint[], campus: string): number {
  const values = data.map((point) => point.values[campus] ?? 0).filter((value) => value > 0);
  if (values.length < 3) return 0;
  const avg = mean(values);
  if (avg === 0) return 0;
  return Math.round((stdDev(values) / avg) * 100);
}

function formatShortDateLabel(iso: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${iso}T00:00:00`));
}

export type Opportunity = {
  category: "volunteer-gap" | "kids-strain" | "assimilation-leak" | "engagement-gap" | "outreach" | "replication" | "capacity" | "concentration-risk" | "seasonal";
  severity: "high" | "medium" | "low" | "positive";
  campus: string | null;
  title: string;
  insight: string;
  action: string;
  evidence: string;
};

type CampusProfile = {
  campus: string;
  attendance: number;
  volunteers: number;
  firstTimeGuests: number;
  salvations: number;
  kids: number;
  growthTrack: number;
  // Period-A vs prior period growth rates (for cross-metric comparisons)
  attendanceGrowth: number;
  volunteerGrowth: number;
  kidsGrowth: number;
  salvationGrowth: number;
  // Ratios on the latest period
  volunteerRatio: number;
  kidsRatio: number;
  ftgRate: number;
  growthTrackRate: number; // growth_track / first_time_guests (only meaningful when cohort-compatible)
  growthTrackComparable: boolean;
};

export function buildOpportunities(metrics: SundayMetric[], filters: ComparisonFilters): Opportunity[] {
  const selectedCampuses = filters.selectedCampuses.filter(Boolean);
  const campusesInScope = selectedCampuses.length > 0 ? selectedCampuses : getAvailableCampuses(metrics);
  if (campusesInScope.length === 0) return [];

  const scopedMetrics = filterMetricsByFields(
    metrics.filter((metric) => campusesInScope.includes(metric.campus)),
    ["attendance", "volunteers", "first_time_guests", "salvations", "kids", "growth_track"],
  );

  const periodA = filters.periodA;
  const profiles = campusesInScope
    .map((campus) => buildCampusProfile(scopedMetrics, campus, periodA, filters.periodB))
    .filter((p): p is CampusProfile => p !== null && p.attendance > 0);

  if (profiles.length === 0) return [];

  // Benchmarks are based only on the campuses included in the active report scope.
  const networkVolunteerRatio = avgNumber(profiles.map((p) => p.volunteerRatio));
  const networkKidsRatio = avgNumber(profiles.map((p) => p.kidsRatio));
  const networkFtgRate = avgNumber(profiles.map((p) => p.ftgRate));
  const networkGrowthTrackRate = avgNumber(
    profiles
      .filter((p) => p.growthTrackComparable)
      .map((p) => p.growthTrackRate)
      .filter((r) => r > 0 && r <= 1),
  );
  const networkTotalAttendance = profiles.reduce((s, p) => s + p.attendance, 0);

  const opps: Opportunity[] = [];

  for (const p of profiles) {
    // 0. CAPACITY WATCH — weekly volunteer coverage is below the operating watch line
    if (p.attendance > 100 && p.volunteerRatio > 0 && p.volunteerRatio < churchGrowthBenchmarks.weeklyVolunteerCoverageWatch) {
      const targetVolunteers = Math.round(p.attendance * churchGrowthBenchmarks.weeklyVolunteerCoverageHealthy);
      const gap = Math.max(targetVolunteers - p.volunteers, 0);
      opps.push({
        category: "volunteer-gap",
        severity: p.attendanceGrowth > 0 ? "high" : "medium",
        campus: p.campus,
        title: `${p.campus} has a capacity risk in weekly volunteer coverage`,
        insight: `${p.campus} is operating at ${formatRatio(p.volunteerRatio)} weekly volunteer coverage. The dashboard watch line is ${formatRatio(churchGrowthBenchmarks.weeklyVolunteerCoverageWatch)} because growth is hard to sustain when Sunday teams do not scale with the room.`,
        action: gap > 0
          ? `Add roughly ${gap.toLocaleString()} weekly serving slots or active volunteers before pushing attendance harder. Start with kids, first impressions, parking, and auditorium support.`
          : "Audit team coverage by service and ministry area before pushing attendance harder.",
        evidence: `Capacity lens | Volunteers ${p.volunteers.toLocaleString()} | Attendance ${p.attendance.toLocaleString()} | Weekly coverage ${formatRatio(p.volunteerRatio)}.`,
      });
    }

    // 1. VOLUNTEER PIPELINE GAP — attendance growth significantly outpaces volunteer growth
    if (p.attendance > 0 && p.attendanceGrowth > 5 && p.volunteerGrowth < p.attendanceGrowth - 8 && p.volunteerRatio >= churchGrowthBenchmarks.weeklyVolunteerCoverageWatch) {
      const targetVolunteers = Math.round(p.attendance * Math.max(networkVolunteerRatio, 0.15));
      const gap = Math.max(targetVolunteers - p.volunteers, 0);
      opps.push({
        category: "volunteer-gap",
        severity: "high",
        campus: p.campus,
        title: `${p.campus} volunteer pipeline is not keeping pace with growth`,
        insight: `Attendance grew ${formatPct(p.attendanceGrowth)} while volunteers grew only ${formatPct(p.volunteerGrowth)}. The ratio is slipping, which usually precedes burnout, dropped responsibilities, and quality decline.`,
        action: gap > 0
          ? `Recruit roughly ${gap.toLocaleString()} additional volunteers in the next 60 days to restore the network-average ratio. Focus on first-impressions, kids, and hospitality teams first — those are visible.`
          : "Audit team coverage by service and area to identify where current volunteers are stretched thinnest.",
        evidence: `Volunteer ratio ${formatRatio(p.volunteerRatio)} (network avg ${formatRatio(networkVolunteerRatio)}). Volunteers ${p.volunteers.toLocaleString()} for ${p.attendance.toLocaleString()} attenders.`,
      });
    }

    // 2. KIDS MINISTRY STRAIN — attendance growing but kids ratio declining or below benchmark
    if (p.attendance > 0 && (p.kidsRatio > churchGrowthBenchmarks.kidsRatioMax * 1.15 || (p.attendanceGrowth > 3 && p.kidsGrowth < p.attendanceGrowth - 5))) {
      opps.push({
        category: "kids-strain",
        severity: "high",
        campus: p.campus,
        title: `${p.campus} kids ministry capacity is tightening`,
        insight: p.kidsRatio > churchGrowthBenchmarks.kidsRatioMax * 1.15
          ? `Kids attendance is ${formatRatio(p.kidsRatio)} of weekend attendance, above the 20-25% family-health range. That can be a healthy family signal, but it becomes a capacity risk if classrooms and leaders are not scaling.`
          : `Adult attendance grew ${formatPct(p.attendanceGrowth)} but kids attendance grew only ${formatPct(p.kidsGrowth)}. Families may be choosing to skip services or not return when classrooms feel full.`,
        action: "Reassess kids classroom capacity, leader-to-child ratios, and check-in flow. A 60-day kids volunteer drive often unlocks the bottleneck before families silently disengage.",
        evidence: `Capacity lens | Kids ratio ${formatRatio(p.kidsRatio)} (healthy range ${formatRatio(churchGrowthBenchmarks.kidsRatioMin)}-${formatRatio(churchGrowthBenchmarks.kidsRatioMax)}). ${p.kids.toLocaleString()} kids vs ${p.attendance.toLocaleString()} attendance.`,
      });
    }

    // 3. ASSIMILATION LEAK — strong FTG count but weak Growth Track conversion
    if (
      p.firstTimeGuests >= 20 &&
      p.growthTrackComparable &&
      p.growthTrackRate > 0 &&
      networkGrowthTrackRate > 0 &&
      p.growthTrackRate < networkGrowthTrackRate * 0.7
    ) {
      const expectedGrowthTrack = Math.round(p.firstTimeGuests * networkGrowthTrackRate);
      opps.push({
        category: "assimilation-leak",
        severity: "high",
        campus: p.campus,
        title: `${p.campus} has a weaker guest-to-Growth-Track handoff`,
        insight: `${p.firstTimeGuests.toLocaleString()} first-time guests were logged this period, and ${p.growthTrack.toLocaleString()} moved into Growth Track in the same reporting window. Because Growth Track volume is below first-time guest volume here, this can be read as a directional next-step conversion signal: ${(p.growthTrackRate * 100).toFixed(1)}% versus the selected scope's ${(networkGrowthTrackRate * 100).toFixed(1)}%.`,
        action: `Audit the guest-to-Growth-Track handoff. Specifically: confirmation timing of follow-up, friction in the signup flow, and whether Growth Track is being introduced from the platform during services. Closing this gap could move ~${Math.max(expectedGrowthTrack - p.growthTrack, 1)} more people into the discipleship pipeline per period.`,
        evidence: `Connection lens | FTG ${p.firstTimeGuests.toLocaleString()} | Growth Track ${p.growthTrack.toLocaleString()} | Directional next-step rate ${(p.growthTrackRate * 100).toFixed(1)}% (scope ${(networkGrowthTrackRate * 100).toFixed(1)}%).`,
      });
    }

    // 4. ENGAGEMENT GAP — attendance growing but salvations flat or declining
    if (p.attendanceGrowth > 5 && p.salvationGrowth < -5) {
      opps.push({
        category: "engagement-gap",
        severity: "medium",
        campus: p.campus,
        title: `${p.campus} is growing in seats but not in response`,
        insight: `Attendance is up ${formatPct(p.attendanceGrowth)}, but salvations are down ${Math.abs(p.salvationGrowth).toFixed(1)}%. The reach signal is improving, but the response signal is not keeping pace.`,
        action: "Review the past 4 weekends for consistency in invitation moments, response cards, prayer team readiness, and next-step prompts. The question is whether the pathway from attendance to response is clear and repeated.",
        evidence: `Connection lens | Attendance ${formatPct(p.attendanceGrowth)} | Salvations ${formatPct(p.salvationGrowth)}.`,
      });
    }

    // 5. OUTREACH OPPORTUNITY — FTG rate well below network
    if (p.attendance > 100 && p.ftgRate > 0 && (p.ftgRate < churchGrowthBenchmarks.firstTimeGuestRateMin || p.ftgRate < networkFtgRate * 0.6)) {
      opps.push({
        category: "outreach",
        severity: "medium",
        campus: p.campus,
        title: `${p.campus} first-time guest flow is below the reach benchmark`,
        insight: `First-time guests are running at ${(p.ftgRate * 100).toFixed(2)}% of attendance. The researched health range is ${(churchGrowthBenchmarks.firstTimeGuestRateMin * 100).toFixed(0)}-${(churchGrowthBenchmarks.firstTimeGuestRateMax * 100).toFixed(0)}%, so this is a reach signal to watch before diagnosing motive or culture.`,
        action: "Run an invitation series (4-6 weeks) tied to a hook: pre-Easter, fall launch, holiday weekends. Provide invite cards/digital assets. Track invite-to-visit conversion weekly during the campaign.",
        evidence: `Reach lens | FTG rate ${(p.ftgRate * 100).toFixed(2)}% | Healthy range ${(churchGrowthBenchmarks.firstTimeGuestRateMin * 100).toFixed(0)}-${(churchGrowthBenchmarks.firstTimeGuestRateMax * 100).toFixed(0)}% | Scope avg ${(networkFtgRate * 100).toFixed(2)}%.`,
      });
    }

    // 6. REPLICATION CANDIDATE — top-quartile volunteer or FTG ratio
    if (profiles.length >= 3) {
      const sortedByVolRatio = [...profiles].sort((a, b) => b.volunteerRatio - a.volunteerRatio);
      const topVolThreshold = sortedByVolRatio[0]?.volunteerRatio ?? 0;
      if (p.volunteerRatio === topVolThreshold && p.volunteerRatio > networkVolunteerRatio * 1.15 && p.attendance > 50) {
        opps.push({
          category: "replication",
          severity: "positive",
          campus: p.campus,
          title: `${p.campus} has the strongest volunteer culture — study it`,
          insight: `Volunteer ratio of ${formatRatio(p.volunteerRatio)} is ${formatPct(((p.volunteerRatio / networkVolunteerRatio) - 1) * 100)} above network. Whatever this campus is doing — recruitment cadence, onboarding, leader development — is working.`,
      action: "Send a senior leader to shadow this campus's volunteer huddle and onboarding flow. Document their playbook and pilot the most transferable element at one underperforming campus next quarter.",
          evidence: `Replication lens | Volunteer ratio ${formatRatio(p.volunteerRatio)} (scope avg ${formatRatio(networkVolunteerRatio)}).`,
        });
      }
    }

    // 7. CAPACITY FOR GROWTH — strong volunteer ratio + flat attendance
    if (p.volunteerRatio > networkVolunteerRatio * 1.1 && Math.abs(p.attendanceGrowth) < 3 && p.attendance > 100) {
      opps.push({
        category: "capacity",
        severity: "low",
        campus: p.campus,
        title: `${p.campus} has the bench depth to grow but isn't`,
        insight: `Strong ${formatRatio(p.volunteerRatio)} volunteer ratio (above network) means hospitality, kids, and serve teams are well-staffed. Yet attendance has been flat (${formatPct(p.attendanceGrowth)}). The capacity to receive growth exists — the magnet for it doesn't.`,
        action: "Pair this campus with an outreach push: community-facing event, neighborhood serve project, or a 'bring one' weekend campaign. The infrastructure can absorb the growth without strain.",
        evidence: `Reach + Capacity lens | Volunteer ratio ${formatRatio(p.volunteerRatio)}, attendance trend ${formatPct(p.attendanceGrowth)}.`,
      });
    }
  }

  // 8. CONCENTRATION RISK — one campus accounts for >40% of network attendance
  if (profiles.length >= 3 && networkTotalAttendance > 0) {
    const topCampus = [...profiles].sort((a, b) => b.attendance - a.attendance)[0];
    const concentration = topCampus.attendance / networkTotalAttendance;
    if (concentration > 0.4) {
      opps.push({
        category: "concentration-risk",
        severity: "medium",
        campus: topCampus.campus,
        title: `${topCampus.campus} carries ${formatPct(concentration * 100)} of total network attendance`,
        insight: `If ${topCampus.campus} has a hard week (weather, leadership transition, building issue), it materially moves the entire ministry's numbers. This is a portfolio concentration issue, not a criticism of smaller campuses.`,
        action: "Set explicit growth targets at the 2-3 next-largest campuses to bring the network's share-of-total under 35%. Resource them disproportionately — campus pastor support, marketing budget, or shared leadership investment.",
        evidence: `Leadership context lens | ${topCampus.campus}: ${topCampus.attendance.toLocaleString()} of ${networkTotalAttendance.toLocaleString()} total (${formatPct(concentration * 100)}).`,
      });
    }
  }

  // 9. SEASONAL PATTERN — recurring weak weeks across the network (only if we have full year data)
  // Only run this when looking at a full year so we have monthly granularity to find low months
  if (!periodA.month && !periodA.quarter) {
    const monthlyTotals = computeMonthlyNetworkTotals(scopedMetrics, periodA.year);
    const lowMonths = identifyWeakMonths(monthlyTotals);
    if (lowMonths.length > 0) {
      opps.push({
        category: "seasonal",
        severity: "low",
        campus: null,
        title: `Recurring soft months: ${lowMonths.map((m) => m.label).join(", ")}`,
        insight: `Across the network, ${lowMonths.map((m) => m.label).join(" and ")} consistently come in below the year's average attendance. These dips look seasonal — vacation cycles, school transitions, cultural rhythms — not crisis-driven.`,
        action: "Plan ahead: a sermon series with high cliffhanger continuity, a community-facing initiative, or a guest speaker rotation during these months. The goal is not to avoid the dip but to soften it from the average.",
        evidence: `Seasonality lens | ${lowMonths.map((m) => `${m.label}: ${m.value.toLocaleString()}`).join(", ")}`,
      });
    }
  }

  // Sort: high severity first, then medium, low, positive
  const severityOrder: Record<Opportunity["severity"], number> = { high: 0, medium: 1, low: 2, positive: 3 };
  opps.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  const fallbackOpps = buildFallbackOpportunities(profiles, filters);
  const mergedOpps = [...opps];

  for (const fallback of fallbackOpps) {
    if (!mergedOpps.some((existing) => existing.title === fallback.title)) {
      mergedOpps.push(fallback);
    }
  }

  mergedOpps.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return mergedOpps.slice(0, 8); // Cap to keep the report focused
}

function buildCampusProfile(
  metrics: SundayMetric[],
  campus: string,
  primary: Period,
  comparison: Period | undefined,
): CampusProfile | null {
  const primaryRecords = filterMetricsByPeriod(metrics, primary).filter((m) => m.campus === campus);
  if (primaryRecords.length === 0) return null;

  // Use comparison period if provided, otherwise derive an "earlier" period of equivalent length
  const priorPeriod = comparison ?? derivePriorPeriod(primary);
  const priorCutoffMonthDay = priorPeriod ? getComparisonCutoffMonthDay(metrics, primary, priorPeriod) : null;
  const priorRecords = priorPeriod
    ? filterMetricsByPeriod(metrics, priorPeriod, priorCutoffMonthDay).filter((m) => m.campus === campus)
    : [];

  const sumField = (records: SundayMetric[], field: keyof SundayMetric): number =>
    records.reduce((s, r) => s + ((r[field] as number | undefined) ?? 0), 0);

  const attendance = sumField(primaryRecords, "attendance");
  const volunteers = sumField(primaryRecords, "volunteers");
  const firstTimeGuests = sumField(primaryRecords, "first_time_guests");
  const salvations = sumField(primaryRecords, "salvations");
  const kids = sumField(primaryRecords, "kids");
  const growthTrack = sumField(primaryRecords, "growth_track");
  const growthTrackComparable = firstTimeGuests > 0 && growthTrack <= firstTimeGuests;

  const priorAttendance = sumField(priorRecords, "attendance");
  const priorVolunteers = sumField(priorRecords, "volunteers");
  const priorKids = sumField(priorRecords, "kids");
  const priorSalvations = sumField(priorRecords, "salvations");

  const growth = (curr: number, prior: number) => (prior === 0 ? 0 : ((curr - prior) / prior) * 100);

  return {
    campus,
    attendance,
    volunteers,
    firstTimeGuests,
    salvations,
    kids,
    growthTrack,
    attendanceGrowth: growth(attendance, priorAttendance),
    volunteerGrowth: growth(volunteers, priorVolunteers),
    kidsGrowth: growth(kids, priorKids),
    salvationGrowth: growth(salvations, priorSalvations),
    volunteerRatio: attendance > 0 ? volunteers / attendance : 0,
    kidsRatio: attendance > 0 ? kids / attendance : 0,
    ftgRate: attendance > 0 ? firstTimeGuests / attendance : 0,
    growthTrackRate: firstTimeGuests > 0 ? growthTrack / firstTimeGuests : 0,
    growthTrackComparable,
  };
}

function derivePriorPeriod(period: Period): Period | null {
  const priorYear = String(Number(period.year) - 1);
  if (Number.isNaN(Number(priorYear))) return null;
  return { year: priorYear, quarter: period.quarter, month: period.month };
}

function computeMonthlyNetworkTotals(metrics: SundayMetric[], year: string): Array<{ label: string; value: number; monthIndex: number }> {
  return monthLabels.map((label, i) => {
    const mm = String(i + 1).padStart(2, "0");
    const total = metrics
      .filter((m) => m.service_date.startsWith(`${year}-${mm}`))
      .reduce((s, m) => s + m.attendance, 0);
    return { label, value: total, monthIndex: i };
  }).filter((m) => m.value > 0);
}

function identifyWeakMonths(monthlyTotals: Array<{ label: string; value: number; monthIndex: number }>): Array<{ label: string; value: number }> {
  if (monthlyTotals.length < 6) return [];
  const avg = monthlyTotals.reduce((s, m) => s + m.value, 0) / monthlyTotals.length;
  // Low months are those at least 10% below average
  return monthlyTotals.filter((m) => m.value < avg * 0.9).map((m) => ({ label: m.label, value: m.value }));
}

function buildFallbackOpportunities(profiles: CampusProfile[], filters: ComparisonFilters): Opportunity[] {
  if (profiles.length === 0) {
    return [];
  }

  if (profiles.length === 1) {
    return buildSingleCampusFallbackOpportunities(profiles[0], filters);
  }

  const results: Opportunity[] = [];
  const periodLabel = formatPeriodLong(filters.periodA) + (filters.periodB ? ` vs ${formatPeriodLong(filters.periodB)}` : "");
  const rankedByVolunteerRatio = [...profiles].sort((a, b) => a.volunteerRatio - b.volunteerRatio);
  const rankedByGrowthTrackRate = [...profiles]
    .filter((profile) => profile.growthTrackComparable)
    .filter((profile) => profile.firstTimeGuests > 0)
    .sort((a, b) => a.growthTrackRate - b.growthTrackRate);
  const strongestMomentumCampus = [...profiles].sort((a, b) => b.attendanceGrowth - a.attendanceGrowth)[0];
  const weakestMomentumCampus = [...profiles].sort((a, b) => a.attendanceGrowth - b.attendanceGrowth)[0];
  const lowestVolunteerCoverage = rankedByVolunteerRatio[0];
  const weakestAssimilation = rankedByGrowthTrackRate[0];

  if (lowestVolunteerCoverage && profiles.length > 1) {
    results.push({
      category: "volunteer-gap",
      severity: "medium",
      campus: lowestVolunteerCoverage.campus,
      title: `${lowestVolunteerCoverage.campus} has the thinnest volunteer coverage in the selected group`,
      insight: `${lowestVolunteerCoverage.campus} is currently operating with a ${formatRatio(lowestVolunteerCoverage.volunteerRatio)} volunteer ratio, the lowest among the campuses in this export scope. That usually means the margin for growth or execution issues is tighter.`,
      action: `Pressure-test team coverage by service at ${lowestVolunteerCoverage.campus}. If there are friction points in kids, hospitality, or parking, prioritize recruiting there before pushing harder on attendance growth.`,
      evidence: `Capacity lens | Weekly volunteer coverage ${formatRatio(lowestVolunteerCoverage.volunteerRatio)} | Attendance ${lowestVolunteerCoverage.attendance.toLocaleString()} | Volunteers ${lowestVolunteerCoverage.volunteers.toLocaleString()}.`,
    });
  }

  if (weakestAssimilation && weakestAssimilation.firstTimeGuests > 0) {
    results.push({
      category: "assimilation-leak",
      severity: "low",
      campus: weakestAssimilation.campus,
      title: `${weakestAssimilation.campus} is the first follow-up workflow to audit`,
      insight: `${weakestAssimilation.campus} has the weakest guest-to-Growth-Track next-step rate in the selected scope. Even if the broader data does not trigger a hard alert, this is the clearest place to tighten the assimilation path.`,
      action: `Trace the guest handoff from Sunday to next-step invitation at ${weakestAssimilation.campus}. Focus on response timing, clear invitations from the platform, and reducing signup friction.`,
      evidence: `Connection lens | FTG ${weakestAssimilation.firstTimeGuests.toLocaleString()} | Growth Track ${weakestAssimilation.growthTrack.toLocaleString()} | Directional next-step rate ${(weakestAssimilation.growthTrackRate * 100).toFixed(1)}%.`,
    });
  }

  if (strongestMomentumCampus && strongestMomentumCampus.attendanceGrowth >= 8) {
    results.push({
      category: "replication",
      severity: "positive",
      campus: strongestMomentumCampus.campus,
      title: `${strongestMomentumCampus.campus} is outperforming its own prior attendance baseline`,
      insight: `${strongestMomentumCampus.campus} is up ${formatPct(strongestMomentumCampus.attendanceGrowth)} in ${periodLabel} versus its own comparable prior period. This is a campus-specific momentum signal, not a raw size comparison against the other locations in scope.`,
      action: `Document what changed at ${strongestMomentumCampus.campus} between periods — promotion rhythm, volunteer readiness, and guest follow-up — and decide which of those practices can transfer to the other campuses in this view.`,
      evidence: `Reach lens | Attendance ${strongestMomentumCampus.attendance.toLocaleString()} | Trend ${formatPct(strongestMomentumCampus.attendanceGrowth)} vs its prior baseline.`,
    });
  }

  if (weakestMomentumCampus && weakestMomentumCampus.attendanceGrowth <= -5) {
    results.push({
      category: "engagement-gap",
      severity: "medium",
      campus: weakestMomentumCampus.campus,
      title: `${weakestMomentumCampus.campus} is below its own prior attendance baseline`,
      insight: `${weakestMomentumCampus.campus} is down ${formatPct(weakestMomentumCampus.attendanceGrowth)} in ${periodLabel} versus its own comparable prior period. The concern here is the campus's own softening trend, not that it is smaller than another campus in the selected view.`,
      action: `Review the last 4-8 weeks at ${weakestMomentumCampus.campus} for service consistency, guest experience friction, and missed follow-up opportunities before the next board packet.`,
      evidence: `Reach lens | Attendance ${weakestMomentumCampus.attendance.toLocaleString()} | Trend ${formatPct(weakestMomentumCampus.attendanceGrowth)} vs its prior baseline.`,
    });
  }

  return results.slice(0, 4);
}

function buildSingleCampusFallbackOpportunities(profile: CampusProfile, filters: ComparisonFilters): Opportunity[] {
  const periodLabel = formatPeriodLong(filters.periodA);
  const priorPeriod = filters.periodB ?? derivePriorPeriod(filters.periodA);
  const priorLabel = priorPeriod ? formatPeriodLong(priorPeriod) : "the prior comparable period";
  const results: Opportunity[] = [];

  results.push({
    category: profile.attendanceGrowth >= 0 ? "replication" : "engagement-gap",
    severity: profile.attendanceGrowth >= 5 ? "positive" : profile.attendanceGrowth <= -5 ? "medium" : "low",
    campus: profile.campus,
    title:
      profile.attendanceGrowth >= 0
        ? `${profile.campus} attendance is outperforming its prior baseline`
        : `${profile.campus} attendance is trailing its prior baseline`,
    insight:
      profile.attendanceGrowth >= 0
        ? `${profile.campus} is up ${formatPct(profile.attendanceGrowth)} in ${periodLabel} versus ${priorLabel}. This indicates the campus has positive momentum relative to its own earlier performance, not just a strong position inside the network.`
        : `${profile.campus} is down ${formatPct(profile.attendanceGrowth)} in ${periodLabel} versus ${priorLabel}. The current result is weaker than this same campus's earlier benchmark and deserves a closer look.`,
    action:
      profile.attendanceGrowth >= 0
        ? `Document what changed at ${profile.campus} between ${priorLabel} and ${periodLabel} — promotion rhythm, volunteer deployment, service flow, and guest follow-up — so that growth drivers are preserved and repeatable.`
        : `Review the attendance trend at ${profile.campus} against ${priorLabel}. Start with schedule consistency, special-event displacement, volunteer coverage, and guest retention from the last 4-8 weeks.`,
    evidence: `Reach lens | Attendance ${profile.attendance.toLocaleString()} | Trend ${formatPct(profile.attendanceGrowth)} vs ${priorLabel}.`,
  });

  results.push({
    category: "volunteer-gap",
    severity: profile.volunteerRatio < churchGrowthBenchmarks.weeklyVolunteerCoverageWatch
      ? "high"
      : profile.volunteerRatio < churchGrowthBenchmarks.weeklyVolunteerCoverageHealthy
        ? "medium"
        : "low",
    campus: profile.campus,
    title: `${profile.campus} volunteer coverage should be watched against current attendance`,
    insight: `${profile.campus} is serving ${profile.attendance.toLocaleString()} attenders with ${profile.volunteers.toLocaleString()} volunteers, a ${formatRatio(profile.volunteerRatio)} coverage ratio. For a single-campus report, this is best read as capacity relative to the campus's own current load rather than compared to other locations.`,
    action:
      profile.volunteerRatio < churchGrowthBenchmarks.weeklyVolunteerCoverageHealthy
        ? `Pressure-test coverage by team and service at ${profile.campus}. If check-in, hospitality, parking, or kids are thin, recruit there before pushing harder on growth.`
        : `Keep tracking volunteer coverage at ${profile.campus} as attendance changes. Healthy momentum is easier to sustain when the serve pipeline grows alongside the room.`,
    evidence: `Capacity lens | Volunteers ${profile.volunteers.toLocaleString()} | Attendance ${profile.attendance.toLocaleString()} | Weekly coverage ${formatRatio(profile.volunteerRatio)}.`,
  });

  if (profile.firstTimeGuests > 0) {
    results.push(
      profile.growthTrackComparable
        ? {
            category: "assimilation-leak",
            severity: profile.growthTrackRate < 0.2 ? "medium" : "low",
            campus: profile.campus,
            title: `${profile.campus} guest follow-up should be judged by next-step conversion, not just volume`,
            insight: `${profile.campus} recorded ${profile.firstTimeGuests.toLocaleString()} first-time guests and ${profile.growthTrack.toLocaleString()} Growth Track movements in ${periodLabel}. Because Growth Track is below guest volume here, this can be read as a same-window next-step conversion signal.`,
            action:
              profile.growthTrackRate < 0.2
                ? `Audit the guest handoff at ${profile.campus}: platform invitation, follow-up timing, signup friction, and whether the next step is clear enough on the same day.`
                : `Maintain the current guest follow-up path at ${profile.campus} and keep watching whether next-step conversion holds as guest volume changes.`,
            evidence: `Connection lens | FTG ${profile.firstTimeGuests.toLocaleString()} | Growth Track ${profile.growthTrack.toLocaleString()} | Directional next-step rate ${(profile.growthTrackRate * 100).toFixed(1)}%.`,
          }
        : {
            category: "assimilation-leak",
            severity: "low",
            campus: profile.campus,
            title: `${profile.campus} Growth Track volume should be read as next-step activity, not direct guest conversion`,
            insight: `${profile.campus} logged ${profile.firstTimeGuests.toLocaleString()} first-time guests and ${profile.growthTrack.toLocaleString()} Growth Track movements in ${periodLabel}. Because Growth Track exceeds guest volume, these counts are not cohort-matched and should not be interpreted as a literal conversion percentage.`,
            action: `Use this as a directional next-step activity signal only. If leadership wants true guest conversion analysis, the data model needs a cohort-based guest-to-next-step linkage instead of period totals alone.`,
            evidence: `Data quality lens | FTG ${profile.firstTimeGuests.toLocaleString()} | Growth Track ${profile.growthTrack.toLocaleString()} | Cohort-compatible: no.`,
          },
    );
  }

  if (profile.salvations > 0 || profile.salvationGrowth !== 0) {
    results.push({
      category: "engagement-gap",
      severity: profile.salvationGrowth < -5 ? "medium" : "low",
      campus: profile.campus,
      title: `${profile.campus} response trend should be read against its own prior period`,
      insight:
        profile.salvationGrowth < 0
          ? `Salvations at ${profile.campus} are down ${formatPct(profile.salvationGrowth)} versus ${priorLabel}. Even if attendance is stable, response moments may be softening.`
          : `Salvations at ${profile.campus} are up ${formatPct(profile.salvationGrowth)} versus ${priorLabel}. That suggests the campus is not only filling seats but moving people toward response.`,
      action:
        profile.salvationGrowth < 0
          ? `Review the past several weekends at ${profile.campus} for consistency in invitation moments, follow-up pathways, and service close clarity.`
          : `Capture the response environment at ${profile.campus} — message flow, invitation moments, and counselor readiness — so the team knows what to preserve.`,
      evidence: `Connection lens | Salvations ${profile.salvations.toLocaleString()} | Trend ${formatPct(profile.salvationGrowth)} vs ${priorLabel}.`,
    });
  }

  return results.slice(0, 4);
}

function avgNumber(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function formatPct(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatRatio(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export type EventNote = {
  date: string;
  note: string;
};

export function getEventNotes(metrics: SundayMetric[]): EventNote[] {
  const seen = new Map<string, string>();
  for (const metric of metrics) {
    if (metric.notes) {
      const key = [metric.service_date, metric.campus, metric.service_time ?? "", metric.notes].join("|");

      if (!seen.has(key)) {
        seen.set(key, metric.campus ? `${metric.campus}: ${metric.notes}` : metric.notes);
      }
    }
  }
  return Array.from(seen.entries())
    .map(([key, note]) => ({ date: key.split("|")[0], note }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export type DistributionRow = {
  campus: string;
  current: number;
  prior: number;
  share: number;       // 0..1 of current period total
  priorShare: number;  // 0..1 of prior period total
  shareChangePp: number; // percentage points change in share
  rank: number;
  rankChange: number; // negative = improved (smaller rank), positive = worse
};

export type DistributionPeriodMode = "ytd" | "lastN" | "year";

export function getDistribution(
  metrics: SundayMetric[],
  metric: KpiKey = "attendance",
  mode: DistributionPeriodMode = "lastN",
  windowSize = 4,
): DistributionRow[] {
  const field = metricFieldMap[metric];
  const metricRecords = filterMetricsByField(metrics, field);
  const dates = getUniqueSortedDates(metricRecords);
  if (dates.length === 0) return [];

  let currentDates: string[] = [];
  let priorDates: string[] = [];

  if (mode === "lastN") {
    currentDates = dates.slice(-windowSize);
    priorDates = dates.slice(-windowSize * 2, -windowSize);
  } else if (mode === "ytd") {
    const latestYear = dates[dates.length - 1].slice(0, 4);
    const priorYear = String(Number(latestYear) - 1);
    currentDates = dates.filter((d) => d.startsWith(latestYear));
    const latestMonthDay = currentDates[currentDates.length - 1]?.slice(5) ?? null;
    priorDates = dates.filter((d) => d.startsWith(priorYear) && (!latestMonthDay || d.slice(5) <= latestMonthDay));
  } else {
    const latestYear = dates[dates.length - 1].slice(0, 4);
    const priorYear = String(Number(latestYear) - 1);
    currentDates = dates.filter((d) => d.startsWith(latestYear));
    const latestMonthDay = currentDates[currentDates.length - 1]?.slice(5) ?? null;
    priorDates = dates.filter((d) => d.startsWith(priorYear) && (!latestMonthDay || d.slice(5) <= latestMonthDay));
  }

  const sumFor = (campus: string, dateList: string[]): number => {
    return metricRecords
      .filter((m) => m.campus === campus && dateList.includes(m.service_date))
      .reduce((s, m) => s + ((m[field] as number | undefined) ?? 0), 0);
  };

  const campuses = getAvailableCampuses(metricRecords);
  const currentValues = campuses.map((c) => ({ campus: c, value: sumFor(c, currentDates) }));
  const priorValues = new Map(campuses.map((c) => [c, sumFor(c, priorDates)]));

  const currentTotal = currentValues.reduce((s, r) => s + r.value, 0);
  const priorTotal = Array.from(priorValues.values()).reduce((s, v) => s + v, 0);

  // Sort current by value desc to compute current rank
  const currentRanked = [...currentValues].sort((a, b) => b.value - a.value);
  const currentRankMap = new Map(currentRanked.map((r, i) => [r.campus, i + 1]));

  const priorRanked = [...priorValues.entries()].sort((a, b) => b[1] - a[1]);
  const priorRankMap = new Map(priorRanked.map(([c], i) => [c, i + 1]));

  return currentRanked
    .filter((r) => r.value > 0)
    .map((r) => {
      const prior = priorValues.get(r.campus) ?? 0;
      const share = currentTotal > 0 ? r.value / currentTotal : 0;
      const priorShare = priorTotal > 0 ? prior / priorTotal : 0;
      const shareChangePp = Math.round((share - priorShare) * 1000) / 10; // 1 decimal place
      const rank = currentRankMap.get(r.campus) ?? 0;
      const priorRank = priorRankMap.get(r.campus) ?? rank;
      return {
        campus: r.campus,
        current: r.value,
        prior,
        share,
        priorShare,
        shareChangePp,
        rank,
        rankChange: rank - priorRank,
      };
    });
}

export type CampusPulse = {
  campus: string;
  latest: number;
  previous: number;
  pctChange: number;
  sparkline: Array<{ date: string; value: number }>;
  latestDate: string;
};

export function getCampusPulse(metrics: SundayMetric[], metric: KpiKey = "attendance", weeks = 8): CampusPulse[] {
  const field = metricFieldMap[metric];
  const metricRecords = filterMetricsByField(metrics, field);
  const campuses = getAvailableCampuses(metricRecords);
  const allDates = getUniqueSortedDates(metricRecords);
  const recentDates = allDates.slice(-weeks);

  return campuses
    .map((campus) => {
      const campusSeries = buildCampusMetricDateSeries(metricRecords.filter((m) => m.campus === campus), field);
      const valueByDate = new Map(campusSeries.map((point) => [point.service_date, point.value]));
      const sparkline = recentDates.map((date) => {
        return { date, value: valueByDate.get(date) ?? 0 };
      });

      const nonZero = sparkline.filter((p) => p.value > 0);
      if (nonZero.length === 0) return null;

      const latest = nonZero[nonZero.length - 1];
      const previous = nonZero[nonZero.length - 2] ?? latest;
      const pctChange = previous.value > 0 ? Math.round(((latest.value - previous.value) / previous.value) * 100) : 0;

      return {
        campus,
        latest: latest.value,
        previous: previous.value,
        pctChange,
        sparkline,
        latestDate: latest.date,
      };
    })
    .filter((p): p is CampusPulse => p !== null)
    .sort((a, b) => b.latest - a.latest);
}

export function getAvailableYears(metrics: SundayMetric[]) {
  return Array.from(new Set(metrics.map((metric) => metric.service_date.slice(0, 4)))).sort();
}

export function getComparisonDatasetFromMetrics(metrics: SundayMetric[], filters: ComparisonFilters): ComparisonDatasetPoint[] {
  const selectedCampuses = filters.selectedCampuses.filter(Boolean);
  const periodA = filters.periodA;
  const comparisonPeriods = getComparisonPeriods(filters);
  const metricRecords = filterMetricsByField(metrics, metricFieldMap[filters.metric]);
  const latestPrimaryDate = getLatestDateWithinPeriod(metricRecords, periodA);
  const aBuckets = getPeriodBuckets(periodA, latestPrimaryDate);
  const comparisonContexts = comparisonPeriods.map((period) => ({
    period,
    label: formatPeriodShort(period),
    cutoffMonthDay: getComparisonCutoffMonthDay(metricRecords, periodA, period),
    buckets: getPeriodBuckets(period, latestPrimaryDate),
  }));

  return aBuckets.map((aBucket, i) => {
    const aMatching = metricRecords.filter((m) => aBucket.matchFn(m.service_date));

    const values: Record<string, number> = {};
    for (const campus of selectedCampuses) {
      const key = comparisonContexts.length > 0 ? `${campus} (${formatPeriodShort(periodA)})` : campus;
      values[key] = aggregateTotals(aMatching.filter((m) => m.campus === campus))[metricFieldMap[filters.metric]];
    }

    comparisonContexts.forEach(({ label, cutoffMonthDay, buckets }) => {
      const comparisonBucket = buckets[i];
      const comparisonMatching = comparisonBucket
        ? metricRecords.filter(
            (m) => comparisonBucket.matchFn(m.service_date) && (!cutoffMonthDay || m.service_date.slice(5) <= cutoffMonthDay),
          )
        : [];
      for (const campus of selectedCampuses) {
        const key = `${campus} (${label})`;
        values[key] = aggregateTotals(comparisonMatching.filter((m) => m.campus === campus))[metricFieldMap[filters.metric]];
      }
    });

    const allKeys = Object.keys(values);
    const numericValues = allKeys.map((k) => values[k] ?? 0);
    const leaderValue = Math.max(...numericValues, 0);
    const followerValue = numericValues.length > 0 ? Math.min(...numericValues) : 0;

    return {
      label: aBucket.label,
      values,
      leader: allKeys.find((k) => (values[k] ?? 0) === leaderValue) ?? "—",
      spread: leaderValue - followerValue,
      total: numericValues.reduce((s, v) => s + v, 0),
    };
  });
}

type Bucket = { label: string; matchFn: (date: string) => boolean };

function getPeriodBuckets(period: Period, latestPrimaryDate?: string | null): Bucket[] {
  if (period.month) {
    // single month → weekly buckets
    const mm = String(period.month).padStart(2, "0");
    const prefix = `${period.year}-${mm}`;
    const allBuckets = [
      { label: "Week 1", matchFn: (d: string) => d.startsWith(prefix) && +d.slice(8, 10) <= 7 },
      { label: "Week 2", matchFn: (d: string) => d.startsWith(prefix) && +d.slice(8, 10) > 7 && +d.slice(8, 10) <= 14 },
      { label: "Week 3", matchFn: (d: string) => d.startsWith(prefix) && +d.slice(8, 10) > 14 && +d.slice(8, 10) <= 21 },
      { label: "Week 4", matchFn: (d: string) => d.startsWith(prefix) && +d.slice(8, 10) > 21 && +d.slice(8, 10) <= 28 },
      { label: "Week 5", matchFn: (d: string) => d.startsWith(prefix) && +d.slice(8, 10) > 28 },
    ];

    if (!latestPrimaryDate || !latestPrimaryDate.startsWith(prefix)) {
      return allBuckets;
    }

    const latestDay = Number(latestPrimaryDate.slice(8, 10));
    const visibleWeeks = latestDay > 28 ? 5 : latestDay > 21 ? 4 : latestDay > 14 ? 3 : latestDay > 7 ? 2 : 1;
    return allBuckets.slice(0, visibleWeeks);
  }

  if (period.quarter) {
    const startMonth = (period.quarter - 1) * 3;
    const buckets = [0, 1, 2].map((offset) => {
      const mi = startMonth + offset;
      const mm = String(mi + 1).padStart(2, "0");
      return {
        label: monthLabels[mi],
        matchFn: (d: string) => d.startsWith(`${period.year}-${mm}`),
      };
    });

    if (!latestPrimaryDate || !isDateInPeriod(latestPrimaryDate, period)) {
      return buckets;
    }

    const latestMonthIndex = Number(latestPrimaryDate.slice(5, 7)) - 1;
    return buckets.filter((_, index) => startMonth + index <= latestMonthIndex);
  }

  // full year → 12 monthly buckets
  const buckets = monthLabels.map((label, i) => {
    const mm = String(i + 1).padStart(2, "0");
    return { label, matchFn: (d: string) => d.startsWith(`${period.year}-${mm}`) };
  });

  if (!latestPrimaryDate || !latestPrimaryDate.startsWith(period.year)) {
    return buckets;
  }

  const latestMonthIndex = Number(latestPrimaryDate.slice(5, 7)) - 1;
  return buckets.filter((_, index) => index <= latestMonthIndex);
}

function filterMetricsByPeriod(metrics: SundayMetric[], period: Period, cutoffMonthDay?: string | null): SundayMetric[] {
  return metrics.filter((m) => {
    if (!isDateInPeriod(m.service_date, period)) return false;
    if (cutoffMonthDay && m.service_date.slice(5) > cutoffMonthDay) return false;
    return true;
  });
}

function isDateInPeriod(date: string, period: Period) {
  if (!date.startsWith(period.year)) return false;
  if (period.quarter) {
    const monthNum = +date.slice(5, 7);
    const q = Math.ceil(monthNum / 3);
    if (q !== period.quarter) return false;
  }
  if (period.month) {
    const monthNum = +date.slice(5, 7);
    if (monthNum !== period.month) return false;
  }
  return true;
}

function getLatestDateWithinPeriod(metrics: SundayMetric[], period: Period): string | null {
  return getUniqueSortedDates(metrics.filter((metric) => isDateInPeriod(metric.service_date, period))).at(-1) ?? null;
}

function periodsShareShape(primary: Period, comparison: Period) {
  return primary.month === comparison.month && primary.quarter === comparison.quarter;
}

function getComparisonCutoffMonthDay(metrics: SundayMetric[], primary: Period, comparison: Period): string | null {
  if (!periodsShareShape(primary, comparison)) return null;
  const latestPrimaryDate = getLatestDateWithinPeriod(metrics, primary);
  return latestPrimaryDate ? latestPrimaryDate.slice(5) : null;
}

export function formatPeriodShort(period: Period): string {
  if (period.month) return `${monthLabels[period.month - 1]} ${period.year}`;
  if (period.quarter) return `Q${period.quarter} ${period.year}`;
  return period.year;
}

export function formatPeriodLong(period: Period): string {
  if (period.month) return `${monthLabels[period.month - 1]} ${period.year}`;
  if (period.quarter) return `Quarter ${period.quarter}, ${period.year}`;
  return `Full Year ${period.year}`;
}

function getPeriodIdentity(period: Period) {
  return `${period.year}|${period.quarter ?? 0}|${period.month ?? 0}`;
}

export function getComparisonPeriods(filters: ComparisonFilters): Period[] {
  const rawPeriods = filters.comparisonPeriods?.length
    ? filters.comparisonPeriods
    : filters.periodB
      ? [filters.periodB]
      : [];
  const primaryKey = getPeriodIdentity(filters.periodA);
  const seen = new Set<string>();

  return rawPeriods.filter((period) => {
    const key = getPeriodIdentity(period);
    if (key === primaryKey || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function getPrimaryComparisonPeriod(filters: ComparisonFilters): Period | undefined {
  return getComparisonPeriods(filters)[0];
}

function formatComparisonScope(filters: ComparisonFilters) {
  const periods = [filters.periodA, ...getComparisonPeriods(filters)];
  return periods.length === 1 ? formatPeriodLong(filters.periodA) : periods.map((period) => formatPeriodLong(period)).join(" vs ");
}

export function getComparisonLineKeys(filters: ComparisonFilters): string[] {
  const campuses = filters.selectedCampuses.filter(Boolean);
  const comparisonPeriods = getComparisonPeriods(filters);
  if (comparisonPeriods.length === 0) return campuses;
  return [filters.periodA, ...comparisonPeriods].flatMap((period) =>
    campuses.map((campus) => `${campus} (${formatPeriodShort(period)})`),
  );
}

export function getRecentRecords(metrics: SundayMetric[], limit = 12) {
  return [...metrics]
    .sort((left, right) => right.service_date.localeCompare(left.service_date))
    .slice(0, limit);
}

export function buildComparisonCsv(data: ComparisonDatasetPoint[], filters: ComparisonFilters) {
  const keys = getComparisonLineKeys(filters);
  const rows = [
    ["Period", ...keys, "Total", "Leader", "Spread"],
    ...data.map((point) => [
      point.label,
      ...keys.map((k) => (point.values[k] ?? 0).toString()),
      point.total.toString(),
      point.leader,
      point.spread.toString(),
    ]),
  ];

  return rows.map((row) => row.join(",")).join("\n");
}

export function buildComparisonBrief(data: ComparisonDatasetPoint[], filters: ComparisonFilters, metrics: SundayMetric[] = []) {
  const keys = getComparisonLineKeys(filters);
  const latestPoint = data.at(-1);
  const averageSpread = Math.round(data.reduce((sum, point) => sum + point.spread, 0) / Math.max(data.length, 1));
  const periodLabel = formatComparisonScope(filters);
  const campuses = filters.selectedCampuses.filter(Boolean);
  const scorecard = metrics.length > 0 ? buildExecutiveScorecard(metrics, filters, campuses) : null;
  const executiveBrief = metrics.length > 0 ? buildExecutiveBrief(metrics, filters, campuses) : null;
  const actionCards = metrics.length > 0 ? buildExecutiveActionCards(metrics, filters, campuses) : [];
  const findings = metrics.length > 0 ? buildExecutiveFindings(metrics, filters, campuses) : [];

  return [
    `Comparison Brief`,
    ``,
    `Selected campuses: ${filters.selectedCampuses.join(", ")}`,
    `Metric: ${getMetricLabel(filters.metric)}`,
    `Timeframe: ${periodLabel}`,
    `Framework: Reach, Connection, and Capacity.`,
    `Benchmarks used: 20% YoY attendance growth target; first-time guests at 2-4% of attendance; kids at 20-25% of attendance; weekly volunteer coverage watch line at 14% and healthy line at 16%.`,
    `Data note: the 40% volunteer-roster target, 75% Growth Track completion, and 80% Growth Track-to-serving goals require roster/cohort data before direct scoring.`,
    ``,
    ...(scorecard
      ? [
          `Growth scorecard:`,
          `Verdict: ${scorecard.verdict}`,
          `Current growth: ${scorecard.currentChange > 0 ? "+" : ""}${scorecard.currentChange}%`,
          `Prior cycle growth: ${scorecard.priorChange === null ? "Not enough history" : `${scorecard.priorChange > 0 ? "+" : ""}${scorecard.priorChange}%`}`,
          `Growth speed: ${scorecard.acceleration === null ? "Not enough history" : `${scorecard.acceleration > 0 ? "+" : ""}${scorecard.acceleration} pts vs prior cycle`}`,
          `Seasonal baseline: ${scorecard.seasonalDelta === null ? "Limited history" : `${scorecard.seasonalDelta > 0 ? "+" : ""}${scorecard.seasonalDelta}% vs historical seasonal baseline`}`,
          `${scorecard.summary}`,
          ...(scorecard.transitions.length > 0
            ? [
                `Transition context:`,
                ...scorecard.transitions.map((event) => `- ${event.campus} · ${event.date} · ${event.type} (${event.timing}) — ${event.note}`),
              ]
            : [`Transition context: No campus pastor or staff transitions logged for this scope.`]),
          `Campus reads:`,
          ...scorecard.campuses.map((campus) =>
            `- ${campus.campus}: ${campus.verdict} | ${campus.lifecycle} | ${campus.currentChange > 0 ? "+" : ""}${campus.currentChange}% current | ${campus.acceleration === null ? "speed n/a" : `${campus.acceleration > 0 ? "+" : ""}${campus.acceleration} pts speed`} | ${campus.reason}`),
          scorecard.dataCaveat ? `Caveat: ${scorecard.dataCaveat}` : "",
          ``,
        ].filter(Boolean)
      : []),
    ...(executiveBrief
      ? [
          `Executive brief:`,
          `${executiveBrief.headline}`,
          `${executiveBrief.summary}`,
          ``,
        ]
      : []),
    ...(actionCards.length > 0
      ? [
          `Executive operating agenda:`,
          ...actionCards.flatMap((card, index) => [
            `${index + 1}. [${card.urgency} · ${card.lens}] ${card.title}`,
            `Diagnosis: ${card.diagnosis}`,
            `Working theory: ${card.hypothesis}`,
            `Decision: ${card.decision}`,
            `Next move: ${card.nextMove}`,
            `Evidence: ${card.evidence.join(" | ")}`,
            `Data to confirm: ${card.dataToConfirm.join(" | ")}`,
          ]),
          ``,
        ]
      : []),
    ...(findings.length > 0
      ? [
          `Priority findings:`,
          ...findings.map((finding, index) => `${index + 1}. [${finding.lens}] ${finding.title} — ${finding.detail}`),
          ``,
        ]
      : []),
    `Latest period leader: ${latestPoint?.leader ?? "—"}`,
    `Latest period spread: ${latestPoint ? latestPoint.spread.toLocaleString() : "0"}`,
    `Average spread: ${averageSpread.toLocaleString()}`,
    `Latest breakdown: ${keys
      .map((k) => `${k} ${(latestPoint?.values[k] ?? 0).toLocaleString()}`)
      .join(" | ")}`,
    ``,
    `Detail:`,
    ...data.map(
      (point) =>
        `${point.label}: ${keys
          .map((k) => `${k} ${(point.values[k] ?? 0).toLocaleString()}`)
          .join(" | ")} | leader ${point.leader} | spread ${point.spread.toLocaleString()}`,
    ),
  ].join("\n");
}

import { buildDonutSvg, buildHorizontalBarChartSvg, buildLineChartSvg, buildVerticalBarChartSvg, getPalette, type LineSeries } from "./svg-charts";

export function buildComparisonHtml(data: ComparisonDatasetPoint[], filters: ComparisonFilters, metrics: SundayMetric[] = []) {
  const metricLabel = getMetricLabel(filters.metric);
  const metricLower = metricLabel.toLowerCase();
  const isComparison = !!filters.periodB;
  const periodALabel = formatPeriodShort(filters.periodA);
  const periodBLabel = filters.periodB ? formatPeriodShort(filters.periodB) : "";
  const periodTitle = isComparison ? `${periodALabel} vs ${periodBLabel}` : formatPeriodLong(filters.periodA);
  const campuses = filters.selectedCampuses.filter(Boolean);
  const isSingleCampusReport = campuses.length === 1;
  const singleCampusName = isSingleCampusReport ? campuses[0] : null;
  const generatedDate = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const scorecard = metrics.length > 0 ? buildExecutiveScorecard(metrics, filters, campuses) : null;
  const executiveBrief = metrics.length > 0 ? buildExecutiveBrief(metrics, filters, campuses) : null;
  const actionCards = metrics.length > 0 ? buildExecutiveActionCards(metrics, filters, campuses) : [];
  const executiveFindings = metrics.length > 0 ? buildExecutiveFindings(metrics, filters, campuses) : [];

  // Aggregate per-campus totals for each period
  const aTotals = new Map<string, number>();
  const bTotals = new Map<string, number>();

  for (const campus of campuses) {
    const aKey = isComparison ? `${campus} (${periodALabel})` : campus;
    const aSum = data.reduce((s, p) => s + (p.values[aKey] ?? 0), 0);
    aTotals.set(campus, aSum);

    if (isComparison) {
      const bKey = `${campus} (${periodBLabel})`;
      const bSum = data.reduce((s, p) => s + (p.values[bKey] ?? 0), 0);
      bTotals.set(campus, bSum);
    }
  }

  // Per-campus comparison rows (only meaningful for two-period mode)
  const campusComparison = campuses.map((campus) => {
    const aVal = aTotals.get(campus) ?? 0;
    const bVal = bTotals.get(campus) ?? 0;
    const change = bVal > 0 ? Math.round(((aVal - bVal) / bVal) * 100) : 0;
    const absoluteChange = aVal - bVal;
    return { campus, aVal, bVal, change, absoluteChange };
  }).sort((x, y) => Math.abs(y.change) - Math.abs(x.change));

  const totalA = Array.from(aTotals.values()).reduce((s, v) => s + v, 0);
  const totalB = Array.from(bTotals.values()).reduce((s, v) => s + v, 0);
  const totalChange = totalB > 0 ? Math.round(((totalA - totalB) / totalB) * 100) : 0;

  // Single-period trend analysis (per campus, first vs last bucket)
  const trendData = data.filter((p) => p.total > 0);
  const firstBucket = trendData[0];
  const lastBucket = trendData[trendData.length - 1];
  const peakBucket = trendData.reduce((best, p) => (p.total > best.total ? p : best), trendData[0] ?? data[0]);
  const overallLeader = lastBucket?.leader ?? "—";
  const overallSpread = trendData.length > 0 ? Math.round(trendData.reduce((s, p) => s + p.spread, 0) / trendData.length) : 0;
  const derivedPriorPeriod = !isComparison ? derivePriorPeriod(filters.periodA) : null;
  const singleCampusPriorCutoffMonthDay =
    isSingleCampusReport && singleCampusName && (filters.periodB || derivedPriorPeriod)
      ? getComparisonCutoffMonthDay(metrics, filters.periodA, filters.periodB ?? derivedPriorPeriod!)
      : null;
  const singleCampusCurrentMetricTotal =
    isSingleCampusReport && singleCampusName
      ? getMetricTotalForCampusPeriod(metrics, singleCampusName, filters.periodA, filters.metric)
      : 0;
  const singleCampusPriorMetricTotal =
    isSingleCampusReport && singleCampusName && (filters.periodB || derivedPriorPeriod)
      ? getMetricTotalForCampusPeriod(
          metrics,
          singleCampusName,
          filters.periodB ?? derivedPriorPeriod!,
          filters.metric,
          singleCampusPriorCutoffMonthDay,
        )
      : 0;
  const singleCampusPriorLabel =
    isSingleCampusReport && (filters.periodB || derivedPriorPeriod)
      ? formatPeriodShort(filters.periodB ?? derivedPriorPeriod!)
      : null;
  const singleCampusPeriodChange =
    singleCampusPriorMetricTotal > 0
      ? Math.round(((singleCampusCurrentMetricTotal - singleCampusPriorMetricTotal) / singleCampusPriorMetricTotal) * 100)
      : 0;

  const singlePeriodCampus = campuses.map((campus) => {
    const vals = trendData.map((p) => p.values[campus] ?? 0).filter((v) => v > 0);
    if (vals.length === 0) return null;
    const first = vals[0];
    const last = vals[vals.length - 1];
    const avg = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
    const peak = Math.max(...vals);
    const low = Math.min(...vals);
    const pct = first > 0 ? Math.round(((last - first) / first) * 100) : 0;
    return { campus, first, last, avg, peak, low, pct };
  }).filter((x): x is NonNullable<typeof x> => x !== null);

  // Top movers (limit to top 3 each side to keep the report focused)
  const topGrowers = isComparison
    ? campusComparison.filter((c) => c.change > 5).slice(0, 3)
    : singlePeriodCampus.filter((c) => c.pct > 5).sort((x, y) => y.pct - x.pct).slice(0, 3);
  const topConcerns = isComparison
    ? campusComparison.filter((c) => c.change < -5).sort((x, y) => x.change - y.change).slice(0, 3)
    : singlePeriodCampus.filter((c) => c.pct < -5).sort((x, y) => x.pct - y.pct).slice(0, 3);

  // Filter out empty rows from the data table
  const nonEmptyData = data.filter((p) => p.total > 0);
  const lineKeys = getComparisonLineKeys(filters);

  // Build opportunities (data-analyst recommendations)
  const opportunities = metrics.length > 0 ? buildOpportunities(metrics, filters) : [];
  const highOpps = opportunities.filter((o) => o.severity === "high");
  const mediumOpps = opportunities.filter((o) => o.severity === "medium");
  const lowOpps = opportunities.filter((o) => o.severity === "low");
  const positiveOpps = opportunities.filter((o) => o.severity === "positive");

  // Build chart SVGs
  const lineChartLabels = nonEmptyData.map((p) => p.label);
  const lineChartSeries: LineSeries[] = lineKeys.map((key, i) => {
    const isPeriodB = isComparison && i >= campuses.length;
    return {
      name: key,
      color: getPalette(i),
      values: nonEmptyData.map((p) => p.values[key] ?? 0),
      dashed: isPeriodB,
    };
  });
  const trendChartSvg = buildLineChartSvg(lineChartLabels, lineChartSeries, { width: 760, height: 280 });

  const campusBarRows = isComparison
    ? campusComparison.map((c) => ({
        label: c.campus,
        values: [
          { name: periodALabel, value: c.aVal, color: getPalette(0) },
          { name: periodBLabel, value: c.bVal, color: getPalette(1) },
        ],
      }))
    : campuses.map((campus, i) => ({
        label: campus,
        values: [{ name: campus, value: aTotals.get(campus) ?? 0, color: getPalette(i) }],
      }));
  const campusBarSvg = buildHorizontalBarChartSvg(campusBarRows, { width: 760 });

  const donutSegments = campuses.map((campus, i) => ({
    name: campus,
    value: aTotals.get(campus) ?? 0,
    color: getPalette(i),
  })).filter((s) => s.value > 0);
  const donutSvg = buildDonutSvg(donutSegments, { size: 260 });

  // Worst weeks chart — only single-period mode where data has multiple buckets
  const worstWeeks = !isComparison && nonEmptyData.length >= 4
    ? [...nonEmptyData].sort((a, b) => a.total - b.total).slice(0, 5).reverse()
    : [];
  const worstWeeksSvg = worstWeeks.length > 0
    ? buildVerticalBarChartSvg(
        worstWeeks.map((p) => ({ label: p.label, value: p.total, color: "#dc2626" })),
        { width: 760, height: 200 },
      )
    : null;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${metricLabel} Report — ${periodTitle}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 48px 56px; color: #0f172a; max-width: 920px; margin: auto; line-height: 1.5; }
      .header { padding-bottom: 24px; border-bottom: 3px solid #0f172a; margin-bottom: 32px; }
      .eyebrow { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.18em; color: #2563eb; }
      h1 { font-size: 32px; font-weight: 700; letter-spacing: -0.03em; margin-top: 8px; line-height: 1.15; }
      .meta { display: flex; gap: 16px; align-items: center; margin-top: 12px; font-size: 13px; color: #64748b; flex-wrap: wrap; }
      .meta-tag { background: #f1f5f9; padding: 4px 10px; border-radius: 999px; font-weight: 600; color: #334155; }
      h2 { font-size: 20px; font-weight: 700; margin-top: 40px; margin-bottom: 16px; letter-spacing: -0.02em; }
      h3 { font-size: 15px; font-weight: 600; color: #334155; }
      p, li { font-size: 14px; line-height: 1.7; color: #475569; }
      .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 8px; }
      .stat-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; background: #fbfbfc; }
      .stat-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #64748b; }
      .stat-value { font-size: 26px; font-weight: 700; margin-top: 6px; color: #0f172a; letter-spacing: -0.02em; }
      .stat-note { font-size: 12px; color: #94a3b8; margin-top: 4px; }
      .grow { color: #059669; } .decline { color: #dc2626; } .stable { color: #64748b; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
      th, td { border-bottom: 1px solid #e5e7eb; padding: 10px 12px; text-align: left; }
      th { background: #f8fafc; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: #64748b; font-weight: 700; border-bottom: 2px solid #cbd5e1; }
      td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
      tr:last-child td { border-bottom: none; }
      .mover { padding: 14px 16px; border-radius: 10px; margin-top: 10px; display: flex; align-items: baseline; gap: 14px; }
      .mover-grow { background: #f0fdf4; border-left: 4px solid #059669; }
      .mover-concern { background: #fef2f2; border-left: 4px solid #dc2626; }
      .mover-name { font-size: 15px; font-weight: 700; color: #0f172a; flex-shrink: 0; min-width: 130px; }
      .mover-pct { font-size: 16px; font-weight: 700; flex-shrink: 0; min-width: 80px; }
      .mover-detail { font-size: 13px; color: #475569; }
      .takeaway { background: #0f172a; color: #f8fafc; padding: 28px; border-radius: 16px; margin-top: 32px; }
      .takeaway h2 { color: #f8fafc; margin-top: 0; border: none; }
      .takeaway p { color: #cbd5e1; font-size: 15px; line-height: 1.7; }
      .takeaway strong { color: #fff; }
      .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; }
      .scroll-table { overflow-x: auto; }
      .opp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 14px; }
      .opp-card { border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px 20px; background: #ffffff; border-left-width: 4px; display: flex; flex-direction: column; }
      .opp-card .opp-evidence { margin-top: auto; }
      .opp-high { border-left-color: #dc2626; background: linear-gradient(to right, #fef2f2 0%, #ffffff 50%); }
      .opp-medium { border-left-color: #f59e0b; background: linear-gradient(to right, #fffbeb 0%, #ffffff 50%); }
      .opp-low { border-left-color: #2563eb; background: linear-gradient(to right, #eff6ff 0%, #ffffff 50%); }
      .opp-positive { border-left-color: #059669; background: linear-gradient(to right, #f0fdf4 0%, #ffffff 50%); }
      .opp-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
      .opp-title { font-size: 15px; font-weight: 700; color: #0f172a; line-height: 1.3; }
      .opp-tag { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; padding: 3px 8px; border-radius: 999px; white-space: nowrap; }
      .opp-tag-high { background: #fee2e2; color: #991b1b; }
      .opp-tag-medium { background: #fef3c7; color: #92400e; }
      .opp-tag-low { background: #dbeafe; color: #1e40af; }
      .opp-tag-positive { background: #dcfce7; color: #166534; }
      .opp-section-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em; color: #64748b; margin-top: 8px; }
      .opp-body { font-size: 13px; color: #334155; line-height: 1.6; margin-top: 4px; }
      .opp-evidence { font-size: 11px; color: #64748b; background: #f8fafc; padding: 8px 10px; border-radius: 8px; margin-top: 10px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
      .opp-summary-bar { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 12px; }
      .opp-summary-pill { padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; }
      .brief-card { border: 1px solid #dbeafe; border-radius: 16px; background: #eff6ff; padding: 20px 22px; margin-top: 18px; }
      .brief-headline { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; color: #0f172a; }
      .brief-body { margin-top: 10px; color: #334155; font-size: 14px; line-height: 1.7; }
      .findings-list { display: grid; gap: 12px; margin-top: 14px; }
      .finding-card { border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px 18px; background: #ffffff; }
      .finding-title { font-size: 15px; font-weight: 700; color: #0f172a; }
      .finding-body { margin-top: 6px; font-size: 13px; color: #475569; line-height: 1.6; }
      .finding-tag { display: inline-flex; margin-top: 10px; padding: 4px 10px; border-radius: 999px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; }
      .finding-positive { background: #dcfce7; color: #166534; }
      .finding-warning { background: #fee2e2; color: #991b1b; }
      .finding-neutral { background: #e2e8f0; color: #334155; }
      .agenda-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 14px; }
      .agenda-card { border: 1px solid #e2e8f0; border-radius: 16px; background: #fbfbfc; padding: 18px 20px; border-left: 4px solid #0f172a; }
      .agenda-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
      .agenda-title { font-size: 15px; font-weight: 700; color: #0f172a; line-height: 1.35; }
      .agenda-pill { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; border-radius: 999px; padding: 4px 9px; white-space: nowrap; }
      .agenda-now { background: #fee2e2; color: #991b1b; }
      .agenda-week { background: #fef3c7; color: #92400e; }
      .agenda-monitor { background: #e2e8f0; color: #334155; }
      .agenda-label { margin-top: 12px; font-size: 10px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #64748b; }
      .agenda-body { margin-top: 4px; font-size: 13px; color: #334155; line-height: 1.6; }
      .agenda-evidence { margin-top: 10px; display: grid; gap: 6px; }
      .agenda-evidence p { background: #ffffff; border-radius: 10px; padding: 7px 9px; font-size: 11px; color: #64748b; }
      .agenda-data { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
      .agenda-data span { background: #ffffff; border: 1px dashed #cbd5e1; border-radius: 999px; padding: 4px 8px; font-size: 10px; color: #475569; font-weight: 600; }
      .chart-card { border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; background: #ffffff; margin-top: 12px; }
      .chart-grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 16px; margin-top: 12px; align-items: start; }
      .chart-grid .chart-card { margin-top: 0; }
      .donut-flex { display: flex; align-items: center; gap: 16px; }
      .donut-legend { font-size: 12px; color: #475569; flex: 1; }
      .donut-legend div { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 4px 0; border-bottom: 1px solid #f1f5f9; }
      .donut-legend div:last-child { border-bottom: none; }
      .donut-legend .swatch { display: inline-flex; align-items: center; gap: 6px; }
      .donut-legend .swatch-color { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
      @page { margin: 0.5in; }
      @media print { body { padding: 24px; } .takeaway { background: #f1f5f9; color: #0f172a; } .takeaway h2, .takeaway p, .takeaway strong { color: #0f172a; } .chart-grid { grid-template-columns: 1fr; } .opp-grid { grid-template-columns: 1fr; } .agenda-grid { grid-template-columns: 1fr; } }
    </style>
  </head>
  <body>
    <div class="header">
      <p class="eyebrow">${metricLabel} Performance Report</p>
      <h1>${periodTitle}</h1>
      <div class="meta">
        <span class="meta-tag">${campuses.length} campus${campuses.length === 1 ? "" : "es"}</span>
        <span class="meta-tag">${campuses.join(" · ")}</span>
        <span>Generated ${generatedDate}</span>
      </div>
    </div>

    ${renderResearchFoundationSection()}

    ${scorecard ? renderScorecardSection(scorecard) : ""}

    ${executiveBrief ? `
    <h2>Leadership brief</h2>
    <div class="brief-card">
      <p class="brief-headline">${escapeHtml(executiveBrief.headline)}</p>
      <p class="brief-body">${escapeHtml(executiveBrief.summary)}</p>
    </div>` : ""}

    ${actionCards.length > 0 ? renderExecutiveActionCardsSection(actionCards) : ""}

    ${executiveFindings.length > 0 ? `
    <h2>Priority findings</h2>
    <div class="findings-list">
      ${executiveFindings.map((finding) => `
        <div class="finding-card">
          <p class="finding-title">${escapeHtml(finding.title)}</p>
          <p class="finding-body">${escapeHtml(finding.detail)}</p>
          <span class="finding-tag finding-${finding.tone}">${escapeHtml(finding.lens)}</span>
        </div>
      `).join("")}
    </div>` : ""}

    ${isComparison
      ? renderComparisonExecSummary(totalA, totalB, totalChange, periodALabel, periodBLabel, metricLower)
      : isSingleCampusReport && singleCampusName
        ? renderSingleCampusExecSummary(singleCampusName, singleCampusCurrentMetricTotal, singleCampusPriorMetricTotal, singleCampusPeriodChange, periodALabel, singleCampusPriorLabel, peakBucket, metricLower)
        : renderSingleExecSummary(overallLeader, peakBucket, overallSpread, metricLower)}

    <h2>Trend over the period</h2>
    <p style="font-size: 13px;">${metricLabel} by ${nonEmptyData.length === 12 ? "month" : nonEmptyData.length <= 5 ? "week" : "period"} for the selected campuses${isComparison ? " across both periods" : ""}.</p>
    <div class="chart-card">${trendChartSvg}</div>

    <div class="chart-grid">
      <div class="chart-card">
        <h3 style="margin-bottom: 8px; font-size: 14px;">${isComparison ? `Campus totals — ${periodALabel} vs ${periodBLabel}` : `Campus totals — ${periodALabel}`}</h3>
        ${campusBarSvg}
      </div>
      <div class="chart-card">
        <h3 style="margin-bottom: 12px; font-size: 14px;">${isComparison ? `${periodALabel} mix` : "Campus mix"}</h3>
        <div class="donut-flex">
          ${donutSvg}
          <div class="donut-legend">
            ${donutSegments.map((s) => `
              <div>
                <span class="swatch"><span class="swatch-color" style="background:${s.color}"></span>${escapeHtml(s.name)}</span>
                <span style="font-weight: 600; color: #0f172a;">${Math.round((s.value / Math.max(donutSegments.reduce((sum, x) => sum + x.value, 0), 1)) * 100)}%</span>
              </div>`).join("")}
          </div>
        </div>
      </div>
    </div>

    ${opportunities.length > 0 ? `
    <h2>Opportunities &amp; recommendations</h2>
    <p style="font-size: 13px;">Cross-metric analysis of the selected period. Each item is grounded in the data and pairs an insight with a specific action.</p>
    <div class="opp-summary-bar">
      ${highOpps.length > 0 ? `<span class="opp-summary-pill opp-tag-high">${highOpps.length} high priority</span>` : ""}
      ${mediumOpps.length > 0 ? `<span class="opp-summary-pill opp-tag-medium">${mediumOpps.length} medium</span>` : ""}
      ${lowOpps.length > 0 ? `<span class="opp-summary-pill opp-tag-low">${lowOpps.length} watch</span>` : ""}
      ${positiveOpps.length > 0 ? `<span class="opp-summary-pill opp-tag-positive">${positiveOpps.length} replicate</span>` : ""}
    </div>
    <div class="opp-grid">${opportunities.map((opp) => renderOpportunityCard(opp)).join("")}</div>` : ""}

    ${isComparison ? `
    <h2>Period-over-period by campus</h2>
    <p>Each campus's combined ${metricLower} for ${periodALabel} vs ${periodBLabel}, sorted by magnitude of change.</p>
    <table>
      <thead>
        <tr>
          <th>Campus</th>
          <th class="num">${periodALabel}</th>
          <th class="num">${periodBLabel}</th>
          <th class="num">Change</th>
          <th class="num">% Change</th>
        </tr>
      </thead>
      <tbody>
        ${campusComparison.map((c) => `
        <tr>
          <td><strong>${c.campus}</strong></td>
          <td class="num">${c.aVal.toLocaleString()}</td>
          <td class="num">${c.bVal.toLocaleString()}</td>
          <td class="num ${c.absoluteChange > 0 ? "grow" : c.absoluteChange < 0 ? "decline" : "stable"}">${c.absoluteChange > 0 ? "+" : ""}${c.absoluteChange.toLocaleString()}</td>
          <td class="num ${c.change > 0 ? "grow" : c.change < 0 ? "decline" : "stable"}"><strong>${c.change > 0 ? "+" : ""}${c.change}%</strong></td>
        </tr>`).join("")}
      </tbody>
    </table>` : ""}

    ${topGrowers.length > 0 ? `
    <h2>Top growth signals</h2>
    ${topGrowers.map((c) => isComparison
      ? `<div class="mover mover-grow">
          <span class="mover-name">${(c as typeof campusComparison[number]).campus}</span>
          <span class="mover-pct grow">+${(c as typeof campusComparison[number]).change}%</span>
          <span class="mover-detail">${(c as typeof campusComparison[number]).bVal.toLocaleString()} → ${(c as typeof campusComparison[number]).aVal.toLocaleString()} ${metricLower} between periods.</span>
        </div>`
      : `<div class="mover mover-grow">
          <span class="mover-name">${(c as typeof singlePeriodCampus[number]).campus}</span>
          <span class="mover-pct grow">+${(c as typeof singlePeriodCampus[number]).pct}%</span>
          <span class="mover-detail">${(c as typeof singlePeriodCampus[number]).first.toLocaleString()} → ${(c as typeof singlePeriodCampus[number]).last.toLocaleString()} ${metricLower}, peaking at ${(c as typeof singlePeriodCampus[number]).peak.toLocaleString()}.</span>
        </div>`).join("")}
    <p style="margin-top: 14px; font-size: 13px;">${topGrowers.length === 1 ? "This campus is" : "These campuses are"} pulling momentum upward. Examine what's working — programming, outreach, leadership investment — and consider replicating it elsewhere. Build capacity plans for sustained growth.</p>
    ` : ""}

    ${topConcerns.length > 0 ? `
    <h2>Areas needing attention</h2>
    ${topConcerns.map((c) => isComparison
      ? `<div class="mover mover-concern">
          <span class="mover-name">${(c as typeof campusComparison[number]).campus}</span>
          <span class="mover-pct decline">${(c as typeof campusComparison[number]).change}%</span>
          <span class="mover-detail">${(c as typeof campusComparison[number]).bVal.toLocaleString()} → ${(c as typeof campusComparison[number]).aVal.toLocaleString()} ${metricLower} between periods.</span>
        </div>`
      : `<div class="mover mover-concern">
          <span class="mover-name">${(c as typeof singlePeriodCampus[number]).campus}</span>
          <span class="mover-pct decline">${(c as typeof singlePeriodCampus[number]).pct}%</span>
          <span class="mover-detail">${(c as typeof singlePeriodCampus[number]).first.toLocaleString()} → ${(c as typeof singlePeriodCampus[number]).last.toLocaleString()} ${metricLower}, low of ${(c as typeof singlePeriodCampus[number]).low.toLocaleString()}.</span>
        </div>`).join("")}
    <p style="margin-top: 14px; font-size: 13px;">Investigate whether ${topConcerns.length === 1 ? "this decline reflects a" : "these declines reflect"} seasonal cycle, programming gap, or deeper engagement issue. Compare against the same period a year prior before drawing conclusions.</p>
    ` : ""}

    ${!isComparison && singlePeriodCampus.length > 0 && !isSingleCampusReport ? `
    <h2>Per-campus summary</h2>
    <table>
      <thead>
        <tr>
          <th>Campus</th>
          <th class="num">Start</th>
          <th class="num">End</th>
          <th class="num">Average</th>
          <th class="num">Peak</th>
          <th class="num">Change</th>
        </tr>
      </thead>
      <tbody>
        ${singlePeriodCampus.map((c) => `
        <tr>
          <td><strong>${c.campus}</strong></td>
          <td class="num">${c.first.toLocaleString()}</td>
          <td class="num">${c.last.toLocaleString()}</td>
          <td class="num">${c.avg.toLocaleString()}</td>
          <td class="num">${c.peak.toLocaleString()}</td>
          <td class="num ${c.pct > 0 ? "grow" : c.pct < 0 ? "decline" : "stable"}"><strong>${c.pct > 0 ? "+" : ""}${c.pct}%</strong></td>
        </tr>`).join("")}
      </tbody>
    </table>` : ""}

    ${worstWeeksSvg ? `
    <h2>Lowest performing weeks</h2>
    <p style="font-size: 13px;">The five weakest periods by combined ${metricLower}. Useful for spotting seasonal patterns or weeks that warrant follow-up.</p>
    <div class="chart-card">${worstWeeksSvg}</div>` : ""}

    <h2>Detailed data</h2>
    <p style="font-size: 13px;">${nonEmptyData.length} period${nonEmptyData.length === 1 ? "" : "s"} with recorded ${metricLower} data.</p>
    <div class="scroll-table">
      <table>
        <thead>
          <tr>
            <th>Period</th>
            ${lineKeys.map((k) => `<th class="num">${k}</th>`).join("")}
            <th class="num">Total</th>
          </tr>
        </thead>
        <tbody>
          ${nonEmptyData.map((point) => `
          <tr>
            <td><strong>${point.label}</strong></td>
            ${lineKeys.map((k) => `<td class="num">${(point.values[k] ?? 0).toLocaleString()}</td>`).join("")}
            <td class="num"><strong>${point.total.toLocaleString()}</strong></td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>

    <div class="takeaway">
      <h2>Key takeaway</h2>
      <p>${buildTakeaway(
        isComparison,
        totalA,
        totalB,
        totalChange,
        periodALabel,
        periodBLabel,
        metricLower,
        firstBucket,
        lastBucket,
        campusComparison,
        singlePeriodCampus,
        singleCampusName,
        singleCampusPriorLabel,
        singleCampusCurrentMetricTotal,
        singleCampusPriorMetricTotal,
        singleCampusPeriodChange,
      )}</p>
    </div>

    <div class="footer">
      <p>Sunday Base Analytics — Confidential leadership report. Generated ${new Date().toLocaleString("en-US")}.</p>
    </div>
  </body>
</html>`;
}

function renderScorecardSection(scorecard: ExecutiveScorecard): string {
  return `
    <h2>Growth scorecard</h2>
    <div class="summary-grid">
      <div class="stat-card">
        <p class="stat-label">Verdict</p>
        <p class="stat-value">${scorecard.verdict}</p>
        <p class="stat-note">Executive read on current growth quality</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Current growth</p>
        <p class="stat-value ${scorecard.currentChange >= 0 ? "grow" : "decline"}">${scorecard.currentChange > 0 ? "+" : ""}${scorecard.currentChange}%</p>
        <p class="stat-note">Versus the comparable prior period</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Growth speed</p>
        <p class="stat-value ${scorecard.acceleration !== null && scorecard.acceleration >= 0 ? "grow" : "decline"}">${scorecard.acceleration === null ? "—" : `${scorecard.acceleration > 0 ? "+" : ""}${scorecard.acceleration} pts`}</p>
        <p class="stat-note">${scorecard.priorChange === null ? "Not enough earlier history" : "Acceleration vs prior growth cycle"}</p>
      </div>
    </div>
    <div class="brief-card" style="margin-top: 16px;">
      <p class="brief-headline">${escapeHtml(scorecard.summary)}</p>
      ${scorecard.dataCaveat ? `<p class="brief-body"><strong>Data caveat:</strong> ${escapeHtml(scorecard.dataCaveat)}</p>` : ""}
    </div>
    <div class="findings-list" style="margin-top: 14px;">
      ${scorecard.campuses.map((campus) => `
        <div class="finding-card">
          <p class="finding-title">${escapeHtml(campus.campus)} · ${escapeHtml(campus.verdict)}</p>
          <p class="finding-body">
            ${escapeHtml(campus.lifecycle)} · ${campus.currentChange > 0 ? "+" : ""}${campus.currentChange}% current growth
            ${campus.acceleration === null ? " · growth speed n/a" : ` · ${campus.acceleration > 0 ? "+" : ""}${campus.acceleration} pts growth speed`}
            ${campus.seasonalDelta === null ? "" : ` · ${campus.seasonalDelta > 0 ? "+" : ""}${campus.seasonalDelta}% vs seasonal baseline`}.
            ${escapeHtml(campus.reason)}
          </p>
        </div>
      `).join("")}
    </div>
    ${scorecard.transitions.length > 0 ? `
      <h3 style="margin-top: 18px;">Leadership transition context</h3>
      <div class="findings-list" style="margin-top: 10px;">
        ${scorecard.transitions.map((event) => `
          <div class="finding-card">
            <p class="finding-title">${escapeHtml(event.campus)} · ${escapeHtml(event.type)}</p>
            <p class="finding-body">${escapeHtml(formatShortDateLabel(event.date))} · ${escapeHtml(event.timing)} · ${escapeHtml(event.note)}</p>
          </div>
        `).join("")}
      </div>
    ` : ""}
  `;
}

function renderResearchFoundationSection(): string {
  return `
    <h2>Research-backed reporting framework</h2>
    <div class="findings-list">
      <div class="finding-card">
        <p class="finding-title">Reach</p>
        <p class="finding-body">Attendance momentum, first-time guest flow, event lift, and year-over-year growth speed. The internal growth target is 20% YoY, and first-time guests are evaluated against a 2-4% of attendance health range.</p>
      </div>
      <div class="finding-card">
        <p class="finding-title">Connection</p>
        <p class="finding-body">Salvations, Growth Track movement, baptism, groups, and whether people are moving from attendance into identifiable next steps. Growth Track is treated as directional activity unless guest cohorts and completion data are available.</p>
      </div>
      <div class="finding-card">
        <p class="finding-title">Capacity</p>
        <p class="finding-body">Volunteer coverage, kids ministry load, service-time pressure, and staff-transition context. Weekly volunteer counts are a useful pressure signal, while the 40% volunteer-roster target requires roster-level Planning Center data.</p>
      </div>
    </div>
  `;
}

function renderExecutiveActionCardsSection(cards: ExecutiveActionCard[]): string {
  const urgencyClass: Record<ExecutiveActionCard["urgency"], string> = {
    "Decide now": "agenda-now",
    "This week": "agenda-week",
    Monitor: "agenda-monitor",
  };

  return `
    <h2>Executive operating agenda</h2>
    <p style="font-size: 13px;">Decision-ready cards built from the selected campuses, aligned comparison window, health ratios, event context, and pathway signals.</p>
    <div class="agenda-grid">
      ${cards.map((card) => `
        <div class="agenda-card">
          <div class="agenda-head">
            <div>
              <p class="agenda-title">${escapeHtml(card.title)}</p>
              <p class="agenda-label" style="margin-top: 6px;">${escapeHtml(card.lens)}</p>
            </div>
            <span class="agenda-pill ${urgencyClass[card.urgency]}">${escapeHtml(card.urgency)}</span>
          </div>
          <p class="agenda-label">Diagnosis</p>
          <p class="agenda-body">${escapeHtml(card.diagnosis)}</p>
          <p class="agenda-label">Working theory</p>
          <p class="agenda-body">${escapeHtml(card.hypothesis)}</p>
          <p class="agenda-label">Decision</p>
          <p class="agenda-body">${escapeHtml(card.decision)}</p>
          <p class="agenda-label">Next move</p>
          <p class="agenda-body">${escapeHtml(card.nextMove)}</p>
          <p class="agenda-label">Evidence</p>
          <div class="agenda-evidence">
            ${card.evidence.slice(0, 4).map((item) => `<p>${escapeHtml(item)}</p>`).join("")}
          </div>
          <p class="agenda-label">Data to confirm</p>
          <div class="agenda-data">
            ${card.dataToConfirm.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderComparisonExecSummary(totalA: number, totalB: number, change: number, labelA: string, labelB: string, metric: string): string {
  const direction = change > 0 ? "grow" : change < 0 ? "decline" : "stable";
  const arrow = change > 0 ? "↑" : change < 0 ? "↓" : "→";
  return `
    <h2>Executive summary</h2>
    <div class="summary-grid">
      <div class="stat-card">
        <p class="stat-label">${labelA} total</p>
        <p class="stat-value">${totalA.toLocaleString()}</p>
        <p class="stat-note">Combined ${metric} this period</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">${labelB} total</p>
        <p class="stat-value">${totalB.toLocaleString()}</p>
        <p class="stat-note">Combined ${metric} this period</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Period change</p>
        <p class="stat-value ${direction}">${arrow} ${change > 0 ? "+" : ""}${change}%</p>
        <p class="stat-note">${(totalA - totalB).toLocaleString()} ${metric} difference</p>
      </div>
    </div>`;
}

function renderSingleExecSummary(leader: string, peak: ComparisonDatasetPoint | undefined, spread: number, metric: string): string {
  return `
    <h2>Executive summary</h2>
    <div class="summary-grid">
      <div class="stat-card">
        <p class="stat-label">Current leader</p>
        <p class="stat-value">${leader}</p>
        <p class="stat-note">Top performer in latest period</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Peak moment</p>
        <p class="stat-value">${peak ? peak.total.toLocaleString() : "—"}</p>
        <p class="stat-note">${peak?.label ?? "—"} combined total</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Avg. spread</p>
        <p class="stat-value">${spread.toLocaleString()}</p>
        <p class="stat-note">Top vs bottom ${metric}</p>
      </div>
    </div>`;
}

function renderSingleCampusExecSummary(
  campus: string,
  currentTotal: number,
  priorTotal: number,
  periodChange: number,
  currentLabel: string,
  priorLabel: string | null,
  peak: ComparisonDatasetPoint | undefined,
  metric: string,
): string {
  const direction = periodChange > 0 ? "grow" : periodChange < 0 ? "decline" : "stable";
  const arrow = periodChange > 0 ? "↑" : periodChange < 0 ? "↓" : "→";
  return `
    <h2>Executive summary</h2>
    <div class="summary-grid">
      <div class="stat-card">
        <p class="stat-label">${escapeHtml(currentLabel)} total</p>
        <p class="stat-value">${currentTotal.toLocaleString()}</p>
        <p class="stat-note">${escapeHtml(campus)} ${metric} this period</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">${escapeHtml(priorLabel ?? "Prior baseline")}</p>
        <p class="stat-value">${priorTotal.toLocaleString()}</p>
        <p class="stat-note">Comparable prior period</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Period change</p>
        <p class="stat-value ${direction}">${arrow} ${periodChange > 0 ? "+" : ""}${periodChange}%</p>
        <p class="stat-note">${peak?.label ?? "Recent peak"} peak at ${peak?.total.toLocaleString() ?? "—"} ${metric}</p>
      </div>
    </div>`;
}

type CampusComparisonRow = { campus: string; aVal: number; bVal: number; change: number; absoluteChange: number };
type SingleCampusRow = { campus: string; first: number; last: number; avg: number; peak: number; low: number; pct: number };

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c));
}

function renderOpportunityCard(opp: Opportunity): string {
  const severityLabel: Record<Opportunity["severity"], string> = {
    high: "High priority",
    medium: "Medium",
    low: "Watch",
    positive: "Replicate",
  };

  return `
    <div class="opp-card opp-${opp.severity}">
      <div class="opp-header">
        <p class="opp-title">${escapeHtml(opp.title)}</p>
        <span class="opp-tag opp-tag-${opp.severity}">${severityLabel[opp.severity]}</span>
      </div>
      <p class="opp-section-label">What the data shows</p>
      <p class="opp-body">${escapeHtml(opp.insight)}</p>
      <p class="opp-section-label">Recommended action</p>
      <p class="opp-body">${escapeHtml(opp.action)}</p>
      <div class="opp-evidence">${escapeHtml(opp.evidence)}</div>
    </div>`;
}

function buildTakeaway(
  isComparison: boolean,
  totalA: number,
  totalB: number,
  totalChange: number,
  labelA: string,
  labelB: string,
  metric: string,
  firstBucket: ComparisonDatasetPoint | undefined,
  lastBucket: ComparisonDatasetPoint | undefined,
  campusComparison: CampusComparisonRow[],
  singleCampus: SingleCampusRow[],
  singleCampusName?: string | null,
  singleCampusPriorLabel?: string | null,
  singleCampusCurrentMetricTotal?: number,
  singleCampusPriorMetricTotal?: number,
  singleCampusPeriodChange?: number,
): string {
  if (isComparison) {
    const winners = campusComparison.filter((c) => c.change > 5).map((c) => c.campus);
    const losers = campusComparison.filter((c) => c.change < -5).map((c) => c.campus);
    const direction = totalChange > 0 ? "increased" : totalChange < 0 ? "decreased" : "held steady";
    const directionEmphasis = totalChange > 0 ? `<strong>up ${totalChange}%</strong>` : totalChange < 0 ? `<strong>down ${Math.abs(totalChange)}%</strong>` : "<strong>flat</strong>";
    let narrative = `Comparing <strong>${labelA}</strong> against <strong>${labelB}</strong>, combined ${metric} ${direction} from ${totalB.toLocaleString()} to ${totalA.toLocaleString()} — ${directionEmphasis}.`;
    if (winners.length > 0) narrative += ` Growth is being driven by <strong>${winners.slice(0, 3).join(", ")}</strong>.`;
    if (losers.length > 0) narrative += ` Pay attention to <strong>${losers.slice(0, 3).join(", ")}</strong>${losers.length > 3 ? ` and ${losers.length - 3} other location${losers.length - 3 === 1 ? "" : "s"}` : ""} where momentum has slipped.`;
    if (winners.length === 0 && losers.length === 0) narrative += ` Performance held steady across all campuses — stability, but worth asking whether you're approaching a plateau that needs fresh initiatives to break through.`;
    return narrative;
  }

  if (singleCampusName && firstBucket && lastBucket) {
    const trendPct = firstBucket.total > 0 ? Math.round(((lastBucket.total - firstBucket.total) / firstBucket.total) * 100) : 0;
    const priorLabel = singleCampusPriorLabel ?? "the prior comparable period";
    const priorTotal = singleCampusPriorMetricTotal ?? 0;
    const currentTotal = singleCampusCurrentMetricTotal ?? lastBucket.total;
    const periodDelta = singleCampusPeriodChange ?? 0;
    let narrative = `<strong>${singleCampusName}</strong> posted ${currentTotal.toLocaleString()} ${metric} in the current reporting period`;
    if (priorTotal > 0) {
      narrative += ` versus ${priorTotal.toLocaleString()} in <strong>${priorLabel}</strong>, a ${periodDelta > 0 ? "gain" : periodDelta < 0 ? "decline" : "flat result"} of <strong>${periodDelta > 0 ? "+" : ""}${periodDelta}%</strong>.`;
    } else {
      narrative += `. A prior comparable baseline was not available, so this report leans more heavily on the internal period trend.`;
    }

    narrative += ` Within the selected period, the campus moved from ${firstBucket.total.toLocaleString()} in ${firstBucket.label} to ${lastBucket.total.toLocaleString()} in ${lastBucket.label} (${trendPct > 0 ? "+" : ""}${trendPct}%).`;

    if (trendPct > 5 && periodDelta >= 0) {
      narrative += ` The current story is sustained momentum, so the next question is what operational or ministry choices drove that consistency and whether they can be protected.`;
    } else if (trendPct < -5 || periodDelta < 0) {
      narrative += ` The current story is softening momentum, so leadership should review service-to-service consistency, volunteer coverage, and guest follow-up before the next reporting cycle.`;
    } else {
      narrative += ` The current story is relative stability, which is useful, but it is worth identifying what would be required to move this campus out of plateau territory.`;
    }

    return narrative;
  }

  if (!firstBucket || !lastBucket || singleCampus.length === 0) {
    return `Insufficient data in this view to draw conclusions. Try expanding the period or selecting more campuses.`;
  }

  const winners = singleCampus.filter((c) => c.pct > 5).map((c) => c.campus);
  const losers = singleCampus.filter((c) => c.pct < -5).map((c) => c.campus);
  const totalFirst = firstBucket.total;
  const totalLast = lastBucket.total;
  const overallPct = totalFirst > 0 ? Math.round(((totalLast - totalFirst) / totalFirst) * 100) : 0;
  const dirText = overallPct > 0 ? `up <strong>${overallPct}%</strong>` : overallPct < 0 ? `down <strong>${Math.abs(overallPct)}%</strong>` : `<strong>flat</strong>`;

  let narrative = `Combined ${metric} moved from ${totalFirst.toLocaleString()} (${firstBucket.label}) to ${totalLast.toLocaleString()} (${lastBucket.label}) — ${dirText}.`;
  if (winners.length > 0) narrative += ` <strong>${winners.slice(0, 3).join(", ")}</strong> ${winners.length === 1 ? "is" : "are"} carrying growth.`;
  if (losers.length > 0) narrative += ` <strong>${losers.slice(0, 3).join(", ")}</strong> ${losers.length === 1 ? "needs" : "need"} attention.`;
  return narrative;
}

function getMetricTotalForCampusPeriod(
  metrics: SundayMetric[],
  campus: string,
  period: Period,
  metric: KpiKey,
  cutoffMonthDay?: string | null,
): number {
  const field = metricFieldMap[metric];
  const records = filterMetricsByPeriod(filterMetricsByField(metrics, field), period, cutoffMonthDay).filter((m) => m.campus === campus);
  return aggregateTotals(records)[metricFieldMap[metric]];
}

function buildDefaultMetrics() {
  return Object.entries(chartDataset).flatMap(([year, campuses]) =>
    Object.entries(campuses).flatMap(([campus, points]) =>
      points.map((point, index) => ({
        id: `${year}-${campus}-${point.label}`,
        service_date: getLastSundayOfMonth(Number(year), index),
        campus,
        attendance: point.attendance,
        volunteers: point.volunteers,
        first_time_guests: point.firstTimeGuests,
        salvations: point.salvations,
        kids: 0,
        growth_track: 0,
        baptism: 0,
        notes: "",
      })),
    ),
  );
}

function getLastSundayOfMonth(year: number, monthIndex: number) {
  const date = new Date(Date.UTC(year, monthIndex + 1, 0));
  const dayOfWeek = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - dayOfWeek);
  return date.toISOString().slice(0, 10);
}

function aggregateTotals(metrics: SundayMetric[]) {
  return metrics.reduce(
    (accumulator, metric) => {
      accumulator.attendance += metric.attendance;
      accumulator.volunteers += metric.volunteers;
      accumulator.first_time_guests += metric.first_time_guests;
      accumulator.salvations += metric.salvations;
      accumulator.kids += metric.kids;
      accumulator.growth_track += metric.growth_track;
      accumulator.baptism += metric.baptism;
      return accumulator;
    },
    {
      attendance: 0,
      volunteers: 0,
      first_time_guests: 0,
      salvations: 0,
      kids: 0,
      growth_track: 0,
      baptism: 0,
    },
  );
}

function getUniqueSortedDates(metrics: SundayMetric[]) {
  return Array.from(new Set(metrics.map((metric) => metric.service_date))).sort((left, right) => left.localeCompare(right));
}

function getRecordAvailableMetricFields(metric: SundayMetric): MetricField[] {
  if (!Array.isArray(metric.available_metrics)) {
    return allMetricFields;
  }

  return metric.available_metrics.filter((field): field is MetricField => allMetricFields.includes(field));
}

export function hasMetricField(metric: SundayMetric, field: MetricField) {
  return getRecordAvailableMetricFields(metric).includes(field);
}

function hasMetricFields(metric: SundayMetric, fields: MetricField[]) {
  return fields.every((field) => hasMetricField(metric, field));
}

function filterMetricsByField(metrics: SundayMetric[], field: MetricField) {
  return metrics.filter((metric) => hasMetricField(metric, field));
}

function filterMetricsByFields(metrics: SundayMetric[], fields: MetricField[]) {
  return metrics.filter((metric) => hasMetricFields(metric, fields));
}

function buildKpiCard(
  key: KpiKey,
  label: string,
  latestValue: number,
  previousValue: number,
  footnote: string,
  sparkline: number[],
): KpiCard {
  const percentageDelta = previousValue === 0 ? 0 : Math.round(((latestValue - previousValue) / previousValue) * 100);

  return {
    key,
    label,
    value: latestValue.toLocaleString(),
    change: `${percentageDelta >= 0 ? "+" : ""}${percentageDelta}%`,
    changeDirection: percentageDelta >= 0 ? "up" : "down",
    footnote,
    sparkline,
  };
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

function normalizeHeader(header: string) {
  return header
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^\w]/g, "");
}

function parseMetricNumber(value: string, rowIndex: number, fieldName: string) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    throw new Error(`Row ${rowIndex + 2} has an invalid number for ${fieldName}.`);
  }

  return parsedValue;
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isSundayMetric(value: unknown): value is SundayMetric {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as SundayMetric;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.service_date === "string" &&
    typeof candidate.campus === "string" &&
    (typeof candidate.service_time === "string" || typeof candidate.service_time === "undefined") &&
    typeof candidate.attendance === "number" &&
    typeof candidate.volunteers === "number" &&
    typeof candidate.first_time_guests === "number" &&
    typeof candidate.salvations === "number" &&
    typeof candidate.kids === "number" &&
    typeof candidate.growth_track === "number" &&
    typeof candidate.baptism === "number" &&
    (candidate.available_metrics === undefined ||
      (Array.isArray(candidate.available_metrics) &&
        candidate.available_metrics.every((field) => typeof field === "string" && allMetricFields.includes(field as MetricField)))) &&
    typeof candidate.notes === "string"
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function inferBundleMetricType(fileName: string) {
  const normalized = fileName.toLowerCase();

  if (normalized.includes("(attendance)")) {
    return "attendance" as const;
  }

  if (normalized.includes("(sunday - dream team)")) {
    return "volunteers" as const;
  }

  if (normalized.includes("(first timers)")) {
    return "first_time_guests" as const;
  }

  if (normalized.includes("(salvations)")) {
    return "salvations" as const;
  }

  if (normalized.includes("(kids)")) {
    return "kids" as const;
  }

  if (normalized.includes("(growth track)")) {
    return "growth_track" as const;
  }

  if (normalized.includes("(baptism)")) {
    return "baptism" as const;
  }

  return null;
}

function parseWeeklyCampusMetricCsv(csvText: string) {
  const rows = parseDelimitedText(csvText);
  const weeklyRowIndex = rows.findIndex((row) => row[0]?.trim().toUpperCase() === "WEEKLY");

  if (weeklyRowIndex === -1) {
    throw new Error("Could not find a WEEKLY header row in one of the uploaded files.");
  }

  const weeklyRow = rows[weeklyRowIndex];
  const dateColumns = weeklyRow
    .map((cell, columnIndex) => ({
      columnIndex,
      value: cell.trim(),
    }))
    .filter((entry) => isUsDate(entry.value));

  const records: Array<{ campus: string; service_date: string; value: number }> = [];

  for (let rowIndex = weeklyRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const campus = normalizeLegacyCampusName(row[0]?.trim() ?? "");

    if (!campus) {
      continue;
    }

    const normalizedCampus = campus.toLowerCase();

    if (
      normalizedCampus === "total" ||
      normalizedCampus === "% swing" ||
      normalizedCampus === "monthly" ||
      normalizedCampus === "quarter"
    ) {
      break;
    }

    dateColumns.forEach(({ columnIndex, value }) => {
      const rawValue = (row[columnIndex] ?? "").replace(/,/g, "").trim();

      if (!rawValue) {
        return;
      }

      const metricValue = Number(rawValue);

      if (!Number.isFinite(metricValue)) {
        return;
      }

      records.push({
        campus,
        service_date: toIsoDate(value),
        value: metricValue,
      });
    });
  }

  return records;
}

function parseExperienceSummaryCsv(csvText: string): SundayMetric[] | null {
  const rows = parseDelimitedText(csvText).filter((row) => row.some((cell) => cell.trim() !== ""));

  if (rows.length < 3) {
    return null;
  }

  const headerRow = rows[0];
  const dateColumns = headerRow
    .map((cell, columnIndex) => ({
      columnIndex,
      value: cell.trim(),
    }))
    .filter((entry) => isUsDate(entry.value));

  if (dateColumns.length < 4) {
    return null;
  }

  const campus = normalizeLegacyCampusName(headerRow[0] ?? "");

  if (!campus) {
    return null;
  }

  const merged = new Map<string, SundayMetric>();
  let currentServiceTime: string | undefined;
  let recognizedMetricCount = 0;

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const label = row[0]?.trim();

    if (!label) {
      continue;
    }

    if (label.toUpperCase() === "TOTALS") {
      // Legacy summary sheets end service sections with a TOTALS block. Reset the
      // active service so the rollup rows are not imported as another service line.
      currentServiceTime = undefined;
      continue;
    }

    if (isExperienceServiceLabel(label)) {
      currentServiceTime = normalizeLegacyServiceTime(label);

      dateColumns.forEach(({ columnIndex, value }) => {
        const note = (row[columnIndex] ?? "").trim();

        if (!note || !currentServiceTime) {
          return;
        }

        const serviceDate = toIsoDate(value);
        const key = [serviceDate, campus, currentServiceTime].join("|");
        const existing = merged.get(key) ?? createEmptyMetricRecord(serviceDate, campus, currentServiceTime);
        existing.notes = appendMetricNote(existing.notes, `${currentServiceTime}: ${note}`);
        merged.set(key, existing);
      });

      continue;
    }

    const metricField = inferExperienceSummaryMetricField(label);

    if (!metricField || !currentServiceTime) {
      continue;
    }

    recognizedMetricCount += 1;

    dateColumns.forEach(({ columnIndex, value }) => {
      const rawValue = (row[columnIndex] ?? "").replace(/,/g, "").trim();

      if (!rawValue) {
        return;
      }

      const metricValue = Number(rawValue);

      if (!Number.isFinite(metricValue)) {
        return;
      }

      const serviceDate = toIsoDate(value);
      const key = [serviceDate, campus, currentServiceTime].join("|");
      const existing = merged.get(key) ?? createEmptyMetricRecord(serviceDate, campus, currentServiceTime);
      existing[metricField] += metricValue;
      existing.available_metrics = Array.from(new Set([...(existing.available_metrics ?? []), metricField]));
      merged.set(key, existing);
    });
  }

  if (recognizedMetricCount === 0) {
    return null;
  }

  return Array.from(merged.values())
    .filter((record) => {
      const totals = record.attendance + record.volunteers + record.first_time_guests + record.salvations + record.kids + record.growth_track + record.baptism;
      return totals > 0 || record.notes.trim() !== "";
    })
    .sort((left, right) => {
      if (left.service_date === right.service_date) {
        if (left.campus === right.campus) {
          return (left.service_time ?? "").localeCompare(right.service_time ?? "");
        }

        return left.campus.localeCompare(right.campus);
      }

      return left.service_date.localeCompare(right.service_date);
    });
}

function isUsDate(value: string) {
  return /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value);
}

function toIsoDate(value: string) {
  const [month, day, year] = value.split("/");
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function createEmptyMetricRecord(serviceDate: string, campus: string, serviceTime?: string): SundayMetric {
  return {
    id: [serviceDate, campus, serviceTime ?? ""].join("|"),
    service_date: serviceDate,
    campus,
    service_time: serviceTime,
    attendance: 0,
    volunteers: 0,
    first_time_guests: 0,
    salvations: 0,
    kids: 0,
    growth_track: 0,
    baptism: 0,
    notes: "",
    available_metrics: [],
  };
}

function isExperienceServiceLabel(label: string) {
  return /experience/i.test(label);
}

function normalizeLegacyServiceTime(label: string) {
  const trimmed = label.trim();
  const match = trimmed.match(/(\d{1,2})(?::(\d{2}))?\s*(a|am|p|pm)\b/i);

  if (!match) {
    return trimmed;
  }

  const [, hourValue, minuteValue = "00", meridiemValue] = match;
  const meridiem = meridiemValue.toUpperCase().startsWith("A") ? "AM" : "PM";
  return minuteValue === "00" ? `${Number(hourValue)}${meridiem}` : `${Number(hourValue)}:${minuteValue}${meridiem}`;
}

function inferExperienceSummaryMetricField(label: string) {
  const normalized = normalizeHeader(label);

  if (normalized === "attendance") {
    return "attendance" as const;
  }

  if (normalized === "baptism") {
    return "baptism" as const;
  }

  if (normalized === "union_kids") {
    return "kids" as const;
  }

  if (normalized === "growth_track") {
    return "growth_track" as const;
  }

  if (normalized === "salvations") {
    return "salvations" as const;
  }

  if (normalized === "first_timers") {
    return "first_time_guests" as const;
  }

  if (normalized === "dream_teamers") {
    return "volunteers" as const;
  }

  return null;
}

function normalizeLegacyCampusName(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  const aliases: Record<string, string> = {
    BWI: "BWI",
    CLT: "North Meck",
    CHARLOTTE: "North Meck",
    COLUMBIA: "Columbia",
    BALTIMORE: "UBC",
    UBC: "UBC",
    FC: "Falls Church",
    FLOWERS: "Flowers",
    "FALLS CHURCH": "Falls Church",
    "SILVER SPRING": "Silver Spring",
    "SILVER SPRINGS": "Silver Springs",
    "NORTH MECK": "North Meck",
    "MINT HILL": "Mint Hill",
  };

  return aliases[trimmed.toUpperCase()] ?? trimmed
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function appendMetricNote(existing: string, next: string) {
  if (!next.trim()) {
    return existing;
  }

  if (!existing.trim()) {
    return next.trim();
  }

  const existingParts = existing.split(" | ").map((part) => part.trim());
  return existingParts.includes(next.trim()) ? existing : `${existing} | ${next.trim()}`;
}

function parseOptionalMetricNumber(value: string | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return 0;
  }

  const parsedValue = Number(trimmed);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function getMetricMergeKey(metric: SundayMetric) {
  return [metric.service_date, metric.campus, metric.service_time ?? ""].join("|");
}

function sanitizeImportedMetrics(metrics: SundayMetric[]) {
  const normalizedServiceTimes = normalizeImportedServiceTimes(metrics);
  const repairedLegacy = repairLegacyImportedMetrics(normalizedServiceTimes.metrics);
  const dedupedOverlap = removeAggregateDetailOverlap(repairedLegacy.metrics);

  return {
    metrics: dedupedOverlap.metrics,
    changed: normalizedServiceTimes.changed || repairedLegacy.changed || dedupedOverlap.changed,
  };
}

function normalizeImportedServiceTimes(metrics: SundayMetric[]) {
  let changed = false;

  const normalized = metrics.map((metric) => {
    if (!metric.service_time) {
      return { ...metric };
    }

    const normalizedServiceTime = normalizeLegacyServiceTime(metric.service_time);

    if (normalizedServiceTime === metric.service_time) {
      return { ...metric };
    }

    changed = true;
    return {
      ...metric,
      service_time: normalizedServiceTime,
    };
  });

  return {
    metrics: mergeSundayMetrics([], normalized),
    changed,
  };
}

function repairLegacyImportedMetrics(metrics: SundayMetric[]) {
  const nextMetrics = metrics.map((metric) => ({ ...metric }));
  const grouped = new Map<string, number[]>();

  nextMetrics.forEach((metric, index) => {
    if (!metric.service_time) {
      return;
    }

    const key = `${metric.service_date}|${metric.campus}`;
    const bucket = grouped.get(key) ?? [];
    bucket.push(index);
    grouped.set(key, bucket);
  });

  let changed = false;

  grouped.forEach((indices) => {
    if (indices.length < 3) {
      return;
    }

    const sortedIndices = [...indices].sort((leftIndex, rightIndex) => {
      return getServiceTimeSortValue(nextMetrics[leftIndex].service_time) - getServiceTimeSortValue(nextMetrics[rightIndex].service_time);
    });

    const culpritIndex = sortedIndices.at(-1);

    if (culpritIndex === undefined) {
      return;
    }

    const culprit = nextMetrics[culpritIndex];
    const otherRecords = sortedIndices.slice(0, -1).map((index) => nextMetrics[index]);
    const othersAttendance = otherRecords.reduce((sum, record) => sum + record.attendance, 0);

    if (othersAttendance <= 0 || culprit.attendance <= othersAttendance) {
      return;
    }

    const repairedAttendance = (culprit.attendance - othersAttendance) / 2;

    if (!Number.isFinite(repairedAttendance) || repairedAttendance < 0 || Math.abs(repairedAttendance - Math.round(repairedAttendance)) > 0.001) {
      return;
    }

    allMetricFields.forEach((field) => {
      const culpritValue = culprit[field];
      const othersValue = otherRecords.reduce((sum, record) => sum + record[field], 0);

      if (othersValue <= 0 || culpritValue <= othersValue) {
        return;
      }

      const repairedValue = (culpritValue - othersValue) / 2;

      if (!Number.isFinite(repairedValue) || repairedValue < 0 || Math.abs(repairedValue - Math.round(repairedValue)) > 0.001) {
        return;
      }

      culprit[field] = Math.round(repairedValue);
      changed = true;
    });
  });

  return {
    metrics: nextMetrics,
    changed,
  };
}

function removeAggregateDetailOverlap(metrics: SundayMetric[]) {
  const nextMetrics = metrics.map((metric) => ({ ...metric }));
  const grouped = new Map<string, number[]>();

  nextMetrics.forEach((metric, index) => {
    const key = `${metric.service_date}|${metric.campus}`;
    const bucket = grouped.get(key) ?? [];
    bucket.push(index);
    grouped.set(key, bucket);
  });

  const removeIndices = new Set<number>();
  let changed = false;

  grouped.forEach((indices) => {
    const detailIndices = indices.filter((index) => Boolean(nextMetrics[index].service_time));
    const aggregateIndices = indices.filter((index) => !nextMetrics[index].service_time);

    if (detailIndices.length === 0 || aggregateIndices.length === 0) {
      return;
    }

    const detailedFields = new Set<MetricField>();
    detailIndices.forEach((index) => {
      getRecordAvailableMetricFields(nextMetrics[index]).forEach((field) => {
        detailedFields.add(field);
      });
    });

    aggregateIndices.forEach((index) => {
      const aggregateRecord = nextMetrics[index];
      const aggregateFields = getRecordAvailableMetricFields(aggregateRecord);
      const overlappingFields = aggregateFields.filter((field) => detailedFields.has(field));

      if (overlappingFields.length === 0) {
        return;
      }

      overlappingFields.forEach((field) => {
        aggregateRecord[field] = 0;
      });

      const remainingFields = aggregateFields.filter((field) => !detailedFields.has(field));
      aggregateRecord.available_metrics = remainingFields;

      if (remainingFields.length === 0 && !aggregateRecord.notes.trim()) {
        removeIndices.add(index);
      }

      changed = true;
    });
  });

  return {
    metrics: nextMetrics.filter((_, index) => !removeIndices.has(index)),
    changed,
  };
}

function getServiceTimeSortValue(value: string | undefined) {
  const normalized = value ? normalizeLegacyServiceTime(value) : undefined;

  if (!normalized) {
    return -1;
  }

  const match = normalized.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);

  if (!match) {
    return Number.MAX_SAFE_INTEGER;
  }

  const [, hourRaw, minuteRaw, meridiemRaw] = match;
  const minute = Number(minuteRaw ?? "0");
  const normalizedHour = Number(hourRaw) % 12;
  const meridiemOffset = meridiemRaw.toUpperCase() === "PM" ? 12 * 60 : 0;
  return normalizedHour * 60 + minute + meridiemOffset;
}

const preloadedCampusBundle: SundayMetric[] = preloadedCampusBundleJson as SundayMetric[];
