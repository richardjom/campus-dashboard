import { useMemo } from "react";
import { ArrowRight, Info } from "lucide-react";
import { hasMetricField, type MetricField, type SundayMetric } from "../lib/sunday-metrics";

type ConversionFunnelCardProps = {
  metrics: SundayMetric[];
  campuses?: string[];
  year?: string;
  title?: string;
  description?: string;
};

type ConversionRow = {
  campus: string;
  attendance: number;
  firstTimeGuests: number;
  growthTrack: number;
  baptism: number;
  salvations: number;
  guestToGrowthTrack: number | null;
  growthTrackActivity: number | null;
  guestToBaptism: number | null;
  salvationToBaptism: number | null;
  note: string;
};

type PathwayMetricPresentation = {
  label: string;
  value: number | null;
  detail: string;
  tone: "positive" | "warning" | "neutral";
  mode: "cohort" | "activity" | "none";
};

export function ConversionFunnelCard({
  metrics,
  campuses,
  year,
  title = "Conversion funnel",
  description = "Directional next-step movement from first-time guests into Growth Track and baptism.",
}: ConversionFunnelCardProps) {
  const rows = useMemo(() => buildConversionRows(metrics, campuses, year), [metrics, campuses, year]);
  const totals = useMemo(() => summarizeRows(rows), [rows]);
  const primaryPathwayMetric = useMemo(
    () => buildPathwayMetricPresentation(totals.attendance, totals.firstTimeGuests, totals.growthTrack),
    [totals.attendance, totals.firstTimeGuests, totals.growthTrack],
  );

  if (rows.length === 0) {
    return (
      <section className="rounded-[30px] border border-gray-200 bg-white p-6 lg:p-7">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eff6ff] text-[#2563eb]">
            <ArrowRight className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Next steps</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-slate-950">{title}</h2>
          </div>
        </div>
        <p className="mt-5 text-sm leading-7 text-gray-600">
          No first-time guest, Growth Track, salvation, or baptism data is available for this scope yet.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[30px] border border-gray-200 bg-white p-6 lg:p-7">
      <div className="flex flex-col gap-5 border-b border-gray-200 pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Next-step movement</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">{description}</p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-[#fbfbfc] px-4 py-2 text-xs font-semibold text-slate-700">
          <Info className="h-3.5 w-3.5" />
          Aggregate data, not cohort tracking
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <ConversionStat
          label={primaryPathwayMetric.label}
          value={formatRate(primaryPathwayMetric.value)}
          detail={primaryPathwayMetric.detail}
          tone={primaryPathwayMetric.tone}
        />
        <ConversionStat
          label="FTG -> Baptism"
          value={formatRate(totals.guestToBaptism)}
          detail={`${totals.baptism.toLocaleString()} baptism / ${totals.firstTimeGuests.toLocaleString()} FTG`}
          tone={getRateTone(totals.guestToBaptism, false)}
        />
        <ConversionStat
          label="Salvation -> Baptism"
          value={formatRate(totals.salvationToBaptism)}
          detail={`${totals.baptism.toLocaleString()} baptism / ${totals.salvations.toLocaleString()} salvations`}
          tone={getRateTone(totals.salvationToBaptism, false)}
        />
      </div>

      <div className="mt-5 overflow-x-auto rounded-[24px] border border-gray-200">
        <div className="grid min-w-[920px] grid-cols-[1.1fr_0.8fr_0.8fr_0.8fr_0.8fr_1.4fr] border-b border-gray-200 bg-[#fbfbfc] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
          <span>Campus</span>
          <span>FTG</span>
          <span>Growth Track</span>
          <span>Pathway rate</span>
          <span>Baptism</span>
          <span>Read</span>
        </div>

        {rows.map((row) => {
          const pathwayMetric = buildPathwayMetricPresentation(row.attendance, row.firstTimeGuests, row.growthTrack);

          return (
            <div
              key={row.campus}
              className="grid min-w-[920px] grid-cols-[1.1fr_0.8fr_0.8fr_0.8fr_0.8fr_1.4fr] items-center border-b border-gray-100 px-4 py-4 text-sm last:border-b-0 hover:bg-[#fbfbfc]"
            >
              <span className="font-semibold text-slate-950">{row.campus}</span>
              <span className="text-slate-700">{row.firstTimeGuests.toLocaleString()}</span>
              <span className="text-slate-700">{row.growthTrack.toLocaleString()}</span>
              <span className="space-y-1">
                <span className={getPathwayBadgeClass(pathwayMetric)}>
                  {formatRate(pathwayMetric.value)}
                </span>
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-gray-400">{pathwayMetric.mode === "cohort" ? "cohort" : pathwayMetric.mode === "activity" ? "activity" : "n/a"}</p>
              </span>
              <span className="text-slate-700">{row.baptism.toLocaleString()}</span>
              <span className="text-xs leading-5 text-gray-600">{row.note}</span>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs leading-5 text-gray-500">
        Stronger reporting will come when Planning Center person-level follow-up is connected: FTG first visit, second
        visit, Growth Track registration, Growth Track completion, serving signup, and baptism can then be measured as
        true cohort conversion instead of aggregate activity. For your church, Growth Track should also be read on its
        monthly 4-week cadence that starts at the top of the month and skips the fifth Sunday when one exists.
      </p>
    </section>
  );
}

function buildConversionRows(metrics: SundayMetric[], campuses?: string[], year?: string): ConversionRow[] {
  const scopedMetrics = metrics.filter((metric) => {
    if (year && !metric.service_date.startsWith(`${year}-`)) {
      return false;
    }

    return true;
  });
  const campusScope = campuses?.length
    ? campuses
    : Array.from(new Set(scopedMetrics.map((metric) => metric.campus))).sort((left, right) => left.localeCompare(right));

  return campusScope
    .map((campus) => {
      const campusRecords = scopedMetrics.filter((metric) => metric.campus === campus);
      const attendance = sumMetric(campusRecords, "attendance");
      const firstTimeGuests = sumMetric(campusRecords, "first_time_guests");
      const growthTrack = sumMetric(campusRecords, "growth_track");
      const baptism = sumMetric(campusRecords, "baptism");
      const salvations = sumMetric(campusRecords, "salvations");
      const guestToGrowthTrack = ratio(growthTrack, firstTimeGuests);
      const growthTrackActivity = ratio(growthTrack, attendance);
      const guestToBaptism = ratio(baptism, firstTimeGuests);
      const salvationToBaptism = ratio(baptism, salvations);

      return {
        campus,
        attendance,
        firstTimeGuests,
        growthTrack,
        baptism,
        salvations,
        guestToGrowthTrack,
        growthTrackActivity,
        guestToBaptism,
        salvationToBaptism,
        note: buildConversionNote(firstTimeGuests, growthTrack, guestToGrowthTrack),
      };
    })
    .filter((row) => row.firstTimeGuests > 0 || row.growthTrack > 0 || row.baptism > 0 || row.salvations > 0);
}

function summarizeRows(rows: ConversionRow[]): Omit<ConversionRow, "campus" | "note"> {
  const totals = rows.reduce(
    (accumulator, row) => {
      accumulator.attendance += row.attendance;
      accumulator.firstTimeGuests += row.firstTimeGuests;
      accumulator.growthTrack += row.growthTrack;
      accumulator.baptism += row.baptism;
      accumulator.salvations += row.salvations;
      return accumulator;
    },
    {
      attendance: 0,
      firstTimeGuests: 0,
      growthTrack: 0,
      baptism: 0,
      salvations: 0,
    },
  );

  return {
    ...totals,
    guestToGrowthTrack: ratio(totals.growthTrack, totals.firstTimeGuests),
    growthTrackActivity: ratio(totals.growthTrack, totals.attendance),
    guestToBaptism: ratio(totals.baptism, totals.firstTimeGuests),
    salvationToBaptism: ratio(totals.baptism, totals.salvations),
  };
}

function sumMetric(records: SundayMetric[], field: MetricField) {
  return records.reduce((sum, record) => (hasMetricField(record, field) ? sum + record[field] : sum), 0);
}

function ratio(numerator: number, denominator: number) {
  if (denominator <= 0) return null;
  return numerator / denominator;
}

function buildConversionNote(firstTimeGuests: number, growthTrack: number, guestToGrowthTrack: number | null) {
  if (firstTimeGuests <= 0 && growthTrack > 0) {
    return "Growth Track activity exists without a first-time guest baseline in this scope.";
  }

  if (firstTimeGuests <= 0) {
    return "No first-time guest baseline yet.";
  }

  if (growthTrack > firstTimeGuests) {
    return "Growth Track exceeds FTG volume, so treat this as next-step activity rather than literal cohort conversion.";
  }

  if (guestToGrowthTrack !== null && guestToGrowthTrack >= 0.5) {
    return "Healthy directional movement from guest reach into the discipleship pathway.";
  }

  if (guestToGrowthTrack !== null && guestToGrowthTrack < 0.25) {
    return "Watch the guest handoff: follow-up speed, invitation clarity, and Growth Track accessibility.";
  }

  return "Directional movement is present; cohort follow-up data would sharpen the read.";
}

function buildPathwayMetricPresentation(attendance: number, firstTimeGuests: number, growthTrack: number): PathwayMetricPresentation {
  if (firstTimeGuests > 0 && growthTrack <= firstTimeGuests) {
    const value = ratio(growthTrack, firstTimeGuests);
    return {
      label: "FTG -> Growth Track",
      value,
      detail: `${growthTrack.toLocaleString()} Growth Track / ${firstTimeGuests.toLocaleString()} FTG`,
      tone: getRateTone(value, false),
      mode: "cohort",
    };
  }

  const activityRate = ratio(growthTrack, attendance);
  return {
    label: "Growth Track activity",
    value: activityRate,
    detail:
      attendance > 0
        ? `${growthTrack.toLocaleString()} Growth Track / ${attendance.toLocaleString()} attendance`
        : `${growthTrack.toLocaleString()} Growth Track activity logged`,
    tone: "neutral",
    mode: growthTrack > 0 ? "activity" : "none",
  };
}

function formatRate(value: number | null) {
  if (value === null || Number.isNaN(value)) return "N/A";
  return `${Math.round(value * 100)}%`;
}

function getRateTone(value: number | null, overBaseline: boolean): "positive" | "warning" | "neutral" {
  if (overBaseline) return "warning";
  if (value === null) return "neutral";
  if (value >= 0.5) return "positive";
  if (value < 0.25) return "warning";
  return "neutral";
}

function getRateBadgeClass(value: number | null, overBaseline: boolean) {
  const tone = getRateTone(value, overBaseline);
  const base = "inline-flex rounded-full px-3 py-1 text-xs font-semibold";

  if (tone === "positive") return `${base} bg-emerald-100 text-emerald-700`;
  if (tone === "warning") return `${base} bg-amber-100 text-amber-700`;
  return `${base} bg-gray-100 text-slate-700`;
}

function getPathwayBadgeClass(presentation: PathwayMetricPresentation) {
  if (presentation.mode === "activity") {
    return "inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700";
  }

  return getRateBadgeClass(presentation.value, false);
}

function ConversionStat({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "positive" | "warning" | "neutral";
}) {
  return (
    <div className="rounded-[24px] border border-gray-200 bg-[#fbfbfc] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">{label}</p>
      <p
        className={[
          "mt-3 text-3xl font-semibold tracking-[-0.05em]",
          tone === "positive" ? "text-emerald-700" : tone === "warning" ? "text-[#c2410c]" : "text-slate-950",
        ].join(" ")}
      >
        {value}
      </p>
      <p className="mt-2 text-xs leading-5 text-gray-500">{detail}</p>
    </div>
  );
}
