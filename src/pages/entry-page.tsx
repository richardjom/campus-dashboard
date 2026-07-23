import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { FileUp, RotateCcw, Send, Upload } from "lucide-react";
import { useSundayMetrics } from "../hooks/use-sunday-metrics";
import { mergeSundayMetrics, parseSundayMetricsCsv, saveImportedMetrics, type SundayMetric } from "../lib/sunday-metrics";

const entryCampusOptions = [
  "BWI",
  "Columbia",
  "UBC",
  "Flowers",
  "Falls Church",
  "Silver Springs",
  "North Meck",
  "Mint Hill",
] as const;

const serviceTimes = ["8:30AM", "10:15AM", "12PM", "1:45PM"] as const;

const metricFields = [
  { key: "attendance", label: "Attendance" },
  { key: "volunteers", label: "Volunteers" },
  { key: "first_time_guests", label: "First-Time Guests" },
  { key: "salvations", label: "Salvations" },
  { key: "kids", label: "Kids" },
  { key: "growth_track", label: "Growth Track" },
  { key: "baptism", label: "Baptism" },
] as const;

type EntryMode = "manual" | "csv";

type ServiceEntry = {
  enabled: boolean;
  attendance: string;
  volunteers: string;
  first_time_guests: string;
  salvations: string;
  kids: string;
  growth_track: string;
  baptism: string;
  notes: string;
};

function createEmptyServiceEntry(): ServiceEntry {
  return {
    enabled: true,
    attendance: "",
    volunteers: "",
    first_time_guests: "",
    salvations: "",
    kids: "",
    growth_track: "",
    baptism: "",
    notes: "",
  };
}

function createInitialEntries() {
  return Object.fromEntries(serviceTimes.map((serviceTime) => [serviceTime, createEmptyServiceEntry()])) as Record<
    (typeof serviceTimes)[number],
    ServiceEntry
  >;
}

export function EntryPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { metrics } = useSundayMetrics();
  const campusOptions = useMemo(
    () => entryCampusOptions,
    [metrics],
  );

  const [mode, setMode] = useState<EntryMode>("manual");
  const [campus, setCampus] = useState<string>(campusOptions[0] ?? "");
  const [serviceDate, setServiceDate] = useState(getMostRecentSundayIso());
  const [serviceEntries, setServiceEntries] = useState(createInitialEntries);
  const [message, setMessage] = useState("Enter a campus Sunday manually or upload a CSV to merge new service data into the current dataset.");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!campus && campusOptions.length > 0) {
      setCampus(campusOptions[0]);
    }
  }, [campus, campusOptions]);

  const totals = useMemo(() => {
    return serviceTimes.reduce(
      (accumulator, serviceTime) => {
        const entry = serviceEntries[serviceTime];

        if (!entry.enabled) {
          return accumulator;
        }

        accumulator.attendance += readMetricValue(entry.attendance);
        accumulator.volunteers += readMetricValue(entry.volunteers);
        accumulator.first_time_guests += readMetricValue(entry.first_time_guests);
        accumulator.salvations += readMetricValue(entry.salvations);
        accumulator.kids += readMetricValue(entry.kids);
        accumulator.growth_track += readMetricValue(entry.growth_track);
        accumulator.baptism += readMetricValue(entry.baptism);
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
  }, [serviceEntries]);

  const openPicker = () => {
    fileInputRef.current?.click();
  };

  const handleServiceFieldChange = (
    serviceTime: (typeof serviceTimes)[number],
    field: keyof ServiceEntry,
    value: string | boolean,
  ) => {
    setServiceEntries((current) => ({
      ...current,
      [serviceTime]: {
        ...current[serviceTime],
        [field]: value,
      },
    }));
  };

  const resetManualForm = () => {
    setServiceDate(getMostRecentSundayIso());
    setServiceEntries(createInitialEntries());
    if (campusOptions[0]) {
      setCampus(campusOptions[0]);
    }
    setError("");
    setMessage("Sunday entry form reset. You can start a fresh campus submission now.");
  };

  const submitManualEntry = () => {
    if (!campus) {
      setError("Select a campus before saving Sunday data.");
      return;
    }

    const records = serviceTimes.flatMap((serviceTime, index) => {
      if (!serviceEntries[serviceTime].enabled) {
        return [];
      }

      const record = buildEntryRecord(serviceDate, campus, serviceTime, index, serviceEntries[serviceTime]);
      return record ? [record] : [];
    });

    if (records.length === 0) {
      setError("Enter at least one service with numbers or notes before saving.");
      return;
    }

    const merged = mergeSundayMetrics(metrics, records);
    saveImportedMetrics(merged);
    setError("");
    setMessage(
      `Saved ${records.length} service entries for ${campus} on ${serviceDate}. The dashboard and records pages now include this Sunday submission.`,
    );
  };

  const handleCsvImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const parsed = parseSundayMetricsCsv(await file.text());
      const merged = mergeSundayMetrics(metrics, parsed);
      saveImportedMetrics(merged);
      setError("");
      setMessage(
        `Imported ${parsed.length.toLocaleString()} rows from ${file.name}. The uploaded CSV has been merged into the current Sunday dataset.`,
      );
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not import that CSV.");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <div className="mx-auto max-w-[1240px] space-y-6 lg:space-y-8">
      <section className="rounded-[30px] border border-gray-200 bg-white p-6 lg:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Sunday entry</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.06em] text-slate-950 sm:text-5xl">
              Capture service data fast
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-gray-600">
              Use this page right after service to enter campus metrics manually or upload a CSV. Service times are
              broken out by `8:30AM`, `10:15AM`, `12PM`, and `1:45PM`, then rolled into the rest of the dashboard
              automatically.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/dashboard"
              className="inline-flex h-12 items-center rounded-2xl border border-gray-200 bg-white px-5 text-sm font-semibold text-slate-900 transition hover:bg-gray-50"
            >
              Back to dashboard
            </Link>
            <Link
              to="/records"
              className="inline-flex h-12 items-center rounded-2xl border border-gray-200 bg-white px-5 text-sm font-semibold text-slate-900 transition hover:bg-gray-50"
            >
              Historical data
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-gray-200 bg-white p-6 lg:p-7">
        <div className="flex flex-wrap gap-3 border-b border-gray-200 pb-6">
          <ModeButton active={mode === "manual"} label="Manual input" onClick={() => setMode("manual")} />
          <ModeButton active={mode === "csv"} label="CSV import" onClick={() => setMode("csv")} />
        </div>

        <div
          className={[
            "mt-6 rounded-[24px] border p-4",
            error ? "border-rose-200 bg-rose-50" : "border-gray-200 bg-[#fbfbfc]",
          ].join(" ")}
        >
          <p className="text-sm leading-6 text-slate-700">{error || message}</p>
        </div>

        {mode === "manual" ? (
          <div className="mt-6 space-y-6">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
              <div className="rounded-[28px] border border-gray-200 bg-[#fbfbfc] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Entry setup</p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Field label="Service date">
                    <input
                      type="date"
                      value={serviceDate}
                      onChange={(event) => setServiceDate(event.target.value)}
                      className={inputClassName}
                    />
                  </Field>
                  <Field label="Campus">
                    <select value={campus} onChange={(event) => setCampus(event.target.value)} className={inputClassName}>
                      {campusOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>

              <div className="rounded-[28px] border border-gray-200 bg-[#fbfbfc] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Campus totals</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {metricFields.map((field) => (
                    <TotalCard key={field.key} label={field.label} value={totals[field.key].toLocaleString()} />
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {serviceTimes.map((serviceTime) => {
                const entry = serviceEntries[serviceTime];

                return (
                  <section key={serviceTime} className="rounded-[28px] border border-gray-200 bg-white p-5">
                    <div className="flex items-start justify-between gap-4 border-b border-gray-200 pb-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Service time</p>
                        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">{serviceTime}</h2>
                      </div>

                      <button
                        onClick={() => handleServiceFieldChange(serviceTime, "enabled", !entry.enabled)}
                        className={[
                          "inline-flex rounded-full border px-4 py-2 text-sm font-semibold transition",
                          entry.enabled
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-gray-200 bg-white text-slate-600 hover:bg-gray-50",
                        ].join(" ")}
                      >
                        {entry.enabled ? "Included" : "Excluded"}
                      </button>
                    </div>

                    <div className={entry.enabled ? "mt-5 space-y-4" : "mt-5 opacity-50"}>
                      <div className="grid gap-4 md:grid-cols-2">
                        {metricFields.map((field) => (
                          <Field key={field.key} label={field.label}>
                            <input
                              type="number"
                              min="0"
                              value={entry[field.key]}
                              disabled={!entry.enabled}
                              onChange={(event) =>
                                handleServiceFieldChange(serviceTime, field.key, event.target.value)
                              }
                              className={inputClassName}
                              placeholder="0"
                            />
                          </Field>
                        ))}
                      </div>

                      <Field label="Notes">
                        <textarea
                          value={entry.notes}
                          disabled={!entry.enabled}
                          onChange={(event) => handleServiceFieldChange(serviceTime, "notes", event.target.value)}
                          className={`${inputClassName} min-h-24 resize-none py-3`}
                          placeholder="Optional notes for this service"
                        />
                      </Field>
                    </div>
                  </section>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={submitManualEntry}
                className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[#2563eb] px-5 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]"
              >
                <Send className="h-4 w-4" />
                Save Sunday entry
              </button>
              <button
                onClick={resetManualForm}
                className="inline-flex h-12 items-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 text-sm font-semibold text-slate-900 transition hover:bg-gray-50"
              >
                <RotateCcw className="h-4 w-4" />
                Reset form
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <section className="rounded-[28px] border border-gray-200 bg-[#fbfbfc] p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eff6ff] text-[#2563eb]">
                  <FileUp className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">CSV import</p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-slate-950">Merge Sunday uploads</h2>
                </div>
              </div>

              <p className="mt-5 max-w-2xl text-sm leading-7 text-gray-600">
                Upload a Sunday entry CSV and it will merge into the current dataset instead of replacing everything.
                If `service_time` is included, those rows are stored per service. If it is omitted, the row is treated
                as a campus total for that Sunday.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleCsvImport}
              />

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={openPicker}
                  className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[#2563eb] px-5 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]"
                >
                  <Upload className="h-4 w-4" />
                  Upload Sunday CSV
                </button>
                <a
                  href="/sample-data/sunday-entry-example.csv"
                  download
                  className="inline-flex h-12 items-center rounded-2xl border border-gray-200 bg-white px-5 text-sm font-semibold text-slate-900 transition hover:bg-gray-50"
                >
                  Download sample CSV
                </a>
              </div>
            </section>

            <section className="rounded-[28px] border border-gray-200 bg-white p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Accepted columns</p>
              <div className="mt-4 rounded-[22px] border border-gray-200 bg-[#fbfbfc] p-4">
                <code className="block whitespace-pre-wrap text-sm leading-7 text-slate-700">
                  id, service_date, campus, service_time, attendance, volunteers, first_time_guests, salvations,
                  kids, growth_track, baptism, notes
                </code>
              </div>

              <div className="mt-5 space-y-4">
                <InfoCard title="Required" body="service_date, campus, attendance, volunteers, first_time_guests, and salvations are required." />
                <InfoCard title="Optional" body="service_time, kids, growth_track, baptism, id, and notes can all be included when you have them." />
                <InfoCard title="Service times" body="Use 8:30AM, 10:15AM, 12PM, or 1:45PM so the import matches the manual entry flow." />
              </div>
            </section>
          </div>
        )}
      </section>
    </div>
  );
}

function buildEntryRecord(
  serviceDate: string,
  campus: string,
  serviceTime: (typeof serviceTimes)[number],
  index: number,
  entry: ServiceEntry,
) {
  const hasValue =
    metricFields.some((field) => readMetricValue(entry[field.key]) > 0) || entry.notes.trim().length > 0;

  if (!hasValue) {
    return null;
  }

  return {
    id: `${serviceDate}-${campus}-${serviceTime}-${index}`,
    service_date: serviceDate,
    campus,
    service_time: serviceTime,
    attendance: readMetricValue(entry.attendance),
    volunteers: readMetricValue(entry.volunteers),
    first_time_guests: readMetricValue(entry.first_time_guests),
    salvations: readMetricValue(entry.salvations),
    kids: readMetricValue(entry.kids),
    growth_track: readMetricValue(entry.growth_track),
    baptism: readMetricValue(entry.baptism),
    notes: entry.notes.trim(),
  } satisfies SundayMetric;
}

function readMetricValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getMostRecentSundayIso() {
  const now = new Date();
  const localDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = localDate.getDay();
  localDate.setDate(localDate.getDate() - day);
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, "0");
  const date = String(localDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${date}`;
}

function ModeButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-full border px-4 py-2 text-sm font-semibold transition",
        active ? "border-[#111827] bg-[#111827] text-white" : "border-gray-200 bg-white text-slate-700 hover:bg-gray-50",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
      {label}
      {children}
    </label>
  );
}

function TotalCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-gray-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">{value}</p>
    </div>
  );
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[22px] border border-gray-200 bg-[#fbfbfc] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-700">{body}</p>
    </div>
  );
}

const inputClassName =
  "h-12 rounded-2xl border border-gray-200 bg-white px-4 text-sm font-medium normal-case tracking-normal text-slate-900 outline-none transition hover:border-gray-300 focus:border-slate-900 disabled:bg-gray-100 disabled:text-gray-400";
