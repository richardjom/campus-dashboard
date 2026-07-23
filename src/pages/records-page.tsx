import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import {
  clearImportedBigEvents,
  parseBigEventsHistoricalCsv,
  saveImportedBigEvents,
} from "../lib/big-events";
import {
  clearImportedMetrics,
  getRecentRecords,
  hasMetricField,
  mergeSundayMetrics,
  parseHistoricalMetricsFiles,
  saveImportedMetrics,
} from "../lib/sunday-metrics";
import { useBigEvents } from "../hooks/use-big-events";
import { useSundayMetrics } from "../hooks/use-sunday-metrics";
import { FileUp, RotateCcw, Upload } from "lucide-react";

export function RecordsPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { metrics, source } = useSundayMetrics();
  const { records: bigEventRecords, hasData: hasBigEventData } = useBigEvents();
  const [message, setMessage] = useState<string>("Upload a CSV with the sunday_metrics schema to replace the mock dashboard data.");
  const [error, setError] = useState<string>("");
  const recentRecords = useMemo(() => getRecentRecords(metrics, 12), [metrics]);

  const openPicker = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    const file = selectedFiles[0];

    if (selectedFiles.length === 0 || !file) {
      return;
    }

    try {
      if (selectedFiles.length === 1) {
        const fileText = await file.text();

        try {
          const parsedEvents = parseBigEventsHistoricalCsv(fileText);
          saveImportedBigEvents(parsedEvents);
          setError("");
          setMessage(
            `Imported ${parsedEvents.length.toLocaleString()} Big 5 event history rows from ${file.name}. Reports and dashboard outlook cards can now compare event lift, falloff, and forward forecasts.`,
          );
          return;
        } catch {
          // fall through to the Sunday metrics import path
        }
      }

      const parsedMetrics = await parseHistoricalMetricsFiles(selectedFiles);
      const mergedMetrics = mergeSundayMetrics(metrics, parsedMetrics);
      saveImportedMetrics(mergedMetrics);
      setError("");
      setMessage(
        `Merged ${parsedMetrics.length.toLocaleString()} uploaded row${
          parsedMetrics.length === 1 ? "" : "s"
        } into ${mergedMetrics.length.toLocaleString()} total dashboard records from ${
          selectedFiles.length > 1 ? `${selectedFiles.length} uploaded files` : file.name
        }. Only the metrics present in each file are updated, so attendance-only uploads no longer wipe out volunteer, guest, or salvation history.`,
      );
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not parse that CSV.");
    } finally {
      event.target.value = "";
    }
  };

  const restoreMockData = () => {
    clearImportedMetrics();
    clearImportedBigEvents();
    setError("");
    setMessage("Imported Sunday metrics and Big 5 event data cleared. The app is back on the default datasets.");
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      <section className="rounded-[30px] border border-gray-200 bg-white p-6 lg:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Historical data</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.06em] text-slate-950 sm:text-5xl">
              Import your own test dataset
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-gray-600">
              You can start testing with your own data now. Upload a flat `sunday_metrics` CSV, a multi-file campus
              bundle, or an older weekend experience summary sheet and the dashboard will switch over to your imported
              records immediately.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={openPicker}
              className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[#2563eb] px-5 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]"
            >
              <Upload className="h-4 w-4" />
              Upload CSV
            </button>
            <button
              onClick={restoreMockData}
              className="inline-flex h-12 items-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 text-sm font-semibold text-slate-900 transition hover:bg-gray-50"
            >
              <RotateCcw className="h-4 w-4" />
              Restore mock data
            </button>
            <a
              href="/sample-data/sunday-metrics-example.csv"
              download
              className="inline-flex h-12 items-center rounded-2xl border border-gray-200 bg-white px-5 text-sm font-semibold text-slate-900 transition hover:bg-gray-50"
            >
              Download sample CSV
            </a>
            <Link
              to="/dashboard"
              className="inline-flex h-12 items-center rounded-2xl border border-gray-200 bg-white px-5 text-sm font-semibold text-slate-900 transition hover:bg-gray-50"
            >
              Back to dashboard
            </Link>
          </div>
        </div>

        <input ref={fileInputRef} type="file" accept=".csv,text/csv" multiple className="hidden" onChange={handleFileChange} />

        <div
          className={[
            "mt-6 rounded-[24px] border p-4",
            error
              ? "border-rose-200 bg-rose-50"
              : source === "imported"
                ? "border-emerald-200 bg-emerald-50"
                : "border-gray-200 bg-[#fbfbfc]",
          ].join(" ")}
        >
          <p className="text-sm leading-6 text-slate-700">{error || message}</p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <section className="rounded-[30px] border border-gray-200 bg-white p-6 lg:p-7">
          <div className="flex items-center gap-3 border-b border-gray-200 pb-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eff6ff] text-[#2563eb]">
              <FileUp className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Schema</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-slate-950">Accepted CSV columns</h2>
            </div>
          </div>

          <div className="mt-6 rounded-[24px] border border-gray-200 bg-[#fbfbfc] p-5">
            <code className="block whitespace-pre-wrap text-sm leading-7 text-slate-700">
              id, service_date, campus, attendance, volunteers, first_time_guests, salvations, notes
            </code>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <InfoCard
              title="Required"
              body="service_date, campus, attendance, volunteers, first_time_guests, and salvations are required."
            />
            <InfoCard
              title="Format"
              body="Use YYYY-MM-DD dates. Notes and id are optional. Campus names can be your real locations."
            />
            <InfoCard
              title="Bundle upload"
              body="You can also select the separate campus dashboard files together. The importer will merge Attendance, Dream Team, First Timers, Salvations, Kids, Growth Track, and Baptism automatically."
            />
            <InfoCard
              title="Partial updates"
              body="If you only upload one metric file, like Attendance, the importer now updates just that metric and preserves the rest of the historical record."
            />
            <InfoCard
              title="Legacy support"
              body="Older Weekend Experience summary exports are supported too, even when the dates run across the top and each service is broken into its own section."
            />
            <InfoCard
              title="Big 5 events"
              body="Big 5 historical event files are stored separately from weekly Sunday metrics, so event ramps, falloff, and future forecasts can be analyzed without polluting the main attendance ledger."
            />
          </div>
        </section>

        <section className="rounded-[30px] border border-gray-200 bg-white p-6 lg:p-7">
          <div className="border-b border-gray-200 pb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Current source</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
              {source === "imported" ? "Imported dataset active" : source === "bundle" ? "Bundled dataset active" : "Mock dataset active"}
            </h2>
          </div>

          <div className="mt-6 space-y-4">
            <InfoCard title="Rows loaded" body={`${metrics.length.toLocaleString()} total records available to the dashboard right now.`} />
            <InfoCard title="What updates" body="Dashboard cards, campus comparisons, charts, and snapshot tables all switch to your imported dataset automatically." />
            <InfoCard title="Best next step" body="Upload your CSV here, then jump back to Dashboard and compare campuses using your own numbers." />
            <InfoCard
              title="Big 5 status"
              body={
                hasBigEventData
                  ? `${bigEventRecords.length.toLocaleString()} Big 5 event records are loaded for event-lift and forecast analysis.`
                  : "No Big 5 event history is loaded yet."
              }
            />
          </div>
        </section>
      </section>

      <section className="rounded-[30px] border border-gray-200 bg-white p-6 lg:p-7">
        <div className="border-b border-gray-200 pb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Preview</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">Recent records in use</h2>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-4 pr-6 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Service date</th>
                <th className="py-4 pr-6 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Campus</th>
                <th className="py-4 pr-6 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Attendance</th>
                <th className="py-4 pr-6 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Volunteers</th>
                <th className="py-4 pr-6 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Guests</th>
                <th className="py-4 pr-6 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Salvations</th>
                <th className="py-4 pr-0 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Notes</th>
              </tr>
            </thead>
            <tbody>
              {recentRecords.map((record) => (
                <tr key={record.id} className="border-b border-gray-200 last:border-b-0">
                  <td className="py-4 pr-6 text-sm text-slate-700">{record.service_date}</td>
                  <td className="py-4 pr-6 text-sm font-semibold text-slate-950">{record.campus}</td>
                  <td className="py-4 pr-6 text-sm text-slate-700">{record.attendance.toLocaleString()}</td>
                  <td className="py-4 pr-6 text-sm text-slate-700">{hasMetricField(record, "volunteers") ? record.volunteers.toLocaleString() : "—"}</td>
                  <td className="py-4 pr-6 text-sm text-slate-700">{hasMetricField(record, "first_time_guests") ? record.first_time_guests.toLocaleString() : "—"}</td>
                  <td className="py-4 pr-6 text-sm text-slate-700">{hasMetricField(record, "salvations") ? record.salvations.toLocaleString() : "—"}</td>
                  <td className="py-4 pr-0 text-sm text-gray-500">{record.notes || (record.available_metrics?.length === 1 && record.available_metrics[0] === "attendance" ? "Attendance-only update" : "—")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[24px] border border-gray-200 bg-[#fbfbfc] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-700">{body}</p>
    </div>
  );
}
