import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle, Clock, Phone, Mail, MessageSquare } from "lucide-react";
import {
  loadPipelineEntries,
  getMockPipelineEntries,
  savePipelineEntries,
  daysSince,
  getPipelineAlerts,
  type PipelineEntry,
  type PipelineStage,
} from "../lib/people";

const stageConfig: Record<PipelineStage, { label: string; description: string; color: string; badgeBg: string; badgeText: string }> = {
  new:       { label: "New Guest",  description: "Visited, no contact yet",    color: "#f97316", badgeBg: "bg-orange-100",  badgeText: "text-orange-700" },
  contacted: { label: "Contacted",  description: "Text or call was sent",      color: "#2563eb", badgeBg: "bg-blue-100",    badgeText: "text-blue-700" },
  returned:  { label: "Returned",   description: "Came back for another visit",color: "#7c3aed", badgeBg: "bg-violet-100",  badgeText: "text-violet-700" },
  connected: { label: "Connected",  description: "In a group or team",         color: "#10b981", badgeBg: "bg-emerald-100", badgeText: "text-emerald-700" },
  inactive:  { label: "Inactive",   description: "Closed out / no response",   color: "#94a3b8", badgeBg: "bg-slate-100",   badgeText: "text-slate-500" },
};

const activeStages: PipelineStage[] = ["new", "contacted", "returned", "connected"];
const allStages: PipelineStage[] = ["new", "contacted", "returned", "connected", "inactive"];

function urgencyLabel(entry: PipelineEntry): { label: string; color: string } {
  if (entry.pipelineStage === "connected" || entry.pipelineStage === "inactive") {
    return { label: "", color: "" };
  }
  const days = entry.pipelineStage === "new"
    ? daysSince(entry.visitDate)
    : daysSince(entry.lastContactDate);

  if (days > 7)  return { label: `${days}d overdue`, color: "text-rose-600" };
  if (days > 3)  return { label: `${days}d since contact`, color: "text-amber-600" };
  return { label: `${days}d ago`, color: "text-gray-500" };
}

export function PipelinePage() {
  const [entries, setEntries] = useState<PipelineEntry[]>([]);
  const [source, setSource] = useState<"mock" | "real">("mock");
  const [activeFilter, setActiveFilter] = useState<PipelineStage | "all">("all");
  const [actionEntry, setActionEntry] = useState<string | null>(null);
  const [actionNote, setActionNote] = useState("");

  useEffect(() => {
    const stored = loadPipelineEntries();
    if (stored.length > 0) {
      setEntries(stored);
      setSource("real");
    } else {
      setEntries(getMockPipelineEntries());
      setSource("mock");
    }

    const onUpdate = () => {
      const updated = loadPipelineEntries();
      if (updated.length > 0) {
        setEntries(updated);
        setSource("real");
      }
    };
    window.addEventListener("church-dashboard-pipeline-updated", onUpdate);
    return () => window.removeEventListener("church-dashboard-pipeline-updated", onUpdate);
  }, []);

  const alerts = useMemo(() => getPipelineAlerts(entries), [entries]);

  const stageCounts = useMemo(() => {
    const counts: Record<PipelineStage, number> = { new: 0, contacted: 0, returned: 0, connected: 0, inactive: 0 };
    for (const entry of entries) counts[entry.pipelineStage] += 1;
    return counts;
  }, [entries]);

  const filtered = useMemo(() => {
    if (activeFilter === "all") return entries.filter((e) => e.pipelineStage !== "inactive");
    return entries.filter((e) => e.pipelineStage === activeFilter);
  }, [entries, activeFilter]);

  const advanceStage = (entryId: string, nextStage: PipelineStage) => {
    const updated = entries.map((e) =>
      e.id === entryId
        ? { ...e, pipelineStage: nextStage, lastContactDate: new Date().toISOString().slice(0, 10), notes: actionNote || e.notes }
        : e,
    );
    setEntries(updated);
    if (source === "real") savePipelineEntries(updated);
    setActionEntry(null);
    setActionNote("");
  };

  const moveToInactive = (entryId: string) => {
    const updated = entries.map((e) =>
      e.id === entryId ? { ...e, pipelineStage: "inactive" as PipelineStage } : e,
    );
    setEntries(updated);
    if (source === "real") savePipelineEntries(updated);
    setActionEntry(null);
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      <section className="rounded-[30px] border border-gray-200 bg-white p-6 lg:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Guest follow-up</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.06em] text-slate-950 sm:text-5xl">
              Assimilation pipeline
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-gray-600">
              Track every first-time guest from their visit to their first connection. Know who needs a call today,
              who came back, and who fell through the cracks — before it's too late.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {alerts.length > 0 && (
              <div className="inline-flex h-12 items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-700">
                <AlertTriangle className="h-4 w-4" />
                {alerts.length} need follow-up
              </div>
            )}
            <Link
              to="/people"
              className="inline-flex h-12 items-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 text-sm font-semibold text-slate-900 transition hover:bg-gray-50"
            >
              View directory
            </Link>
          </div>
        </div>
      </section>

      {/* Stage summary cards */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {activeStages.map((stage) => {
          const cfg = stageConfig[stage];
          return (
            <button
              key={stage}
              onClick={() => setActiveFilter(activeFilter === stage ? "all" : stage)}
              className={[
                "rounded-[26px] border p-5 text-left transition",
                activeFilter === stage
                  ? "border-slate-900 bg-slate-950"
                  : "border-gray-200 bg-white hover:border-gray-300",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-3">
                <p className={["text-sm font-medium", activeFilter === stage ? "text-slate-400" : "text-gray-500"].join(" ")}>
                  {cfg.label}
                </p>
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cfg.color }} />
              </div>
              <p className={["mt-3 text-[40px] font-semibold leading-none tracking-[-0.06em]", activeFilter === stage ? "text-white" : "text-slate-950"].join(" ")}>
                {stageCounts[stage]}
              </p>
              <p className={["mt-3 text-xs", activeFilter === stage ? "text-slate-400" : "text-gray-500"].join(" ")}>
                {cfg.description}
              </p>
            </button>
          );
        })}
      </section>

      {/* Overdue alerts */}
      {alerts.length > 0 && activeFilter === "all" && (
        <section className="rounded-[30px] border border-amber-200 bg-amber-50 p-6 lg:p-7">
          <div className="flex items-center gap-3 border-b border-amber-200 pb-5">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.04em] text-amber-900">Needs attention</h2>
              <p className="text-sm text-amber-700">These guests haven't been contacted or are overdue for follow-up.</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {alerts.map((entry) => {
              const urgency = urgencyLabel(entry);
              return (
                <div key={entry.id} className="flex items-center justify-between gap-4 rounded-[20px] border border-amber-200 bg-white p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-semibold text-amber-700">
                      {entry.personName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{entry.personName}</p>
                      <p className="text-xs text-gray-500">
                        {entry.campus} · visited {entry.visitDate}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className={["text-xs font-semibold", urgency.color].join(" ")}>{urgency.label}</p>
                    <span className={["inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", stageConfig[entry.pipelineStage].badgeBg, stageConfig[entry.pipelineStage].badgeText].join(" ")}>
                      {stageConfig[entry.pipelineStage].label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Pipeline list */}
      <section className="rounded-[30px] border border-gray-200 bg-white p-6 lg:p-7">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Pipeline</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
              {activeFilter === "all" ? "Active guests" : stageConfig[activeFilter].label}
              <span className="ml-3 text-lg font-normal text-gray-400">({filtered.length})</span>
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterPill label="Active" active={activeFilter === "all"} onClick={() => setActiveFilter("all")} />
            {allStages.map((stage) => (
              <FilterPill
                key={stage}
                label={stageConfig[stage].label}
                active={activeFilter === stage}
                onClick={() => setActiveFilter(activeFilter === stage ? "all" : stage)}
                count={stageCounts[stage]}
              />
            ))}
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {filtered.length === 0 && (
            <p className="py-10 text-center text-sm text-gray-400">No guests in this stage right now.</p>
          )}
          {filtered.map((entry) => {
            const urgency = urgencyLabel(entry);
            const isExpanded = actionEntry === entry.id;

            return (
              <div key={entry.id} className="py-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
                      {entry.personName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{entry.personName}</p>
                      <p className="mt-0.5 text-sm text-gray-500">
                        {entry.campus || "—"} · visited {entry.visitDate}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        {entry.email && (
                          <a href={`mailto:${entry.email}`} className="inline-flex items-center gap-1 text-xs text-[#2563eb] hover:underline">
                            <Mail className="h-3 w-3" />
                            {entry.email}
                          </a>
                        )}
                        {entry.phone && (
                          <a href={`tel:${entry.phone}`} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:underline">
                            <Phone className="h-3 w-3" />
                            {entry.phone}
                          </a>
                        )}
                      </div>
                      {entry.notes && (
                        <p className="mt-1 text-xs text-gray-400">{entry.notes}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {urgency.label && (
                      <span className={["flex items-center gap-1 text-xs font-semibold", urgency.color].join(" ")}>
                        <Clock className="h-3 w-3" />
                        {urgency.label}
                      </span>
                    )}
                    <span className={["inline-flex rounded-full px-3 py-1 text-xs font-semibold", stageConfig[entry.pipelineStage].badgeBg, stageConfig[entry.pipelineStage].badgeText].join(" ")}>
                      {stageConfig[entry.pipelineStage].label}
                    </span>
                    {entry.pipelineStage !== "connected" && entry.pipelineStage !== "inactive" && (
                      <button
                        onClick={() => setActionEntry(isExpanded ? null : entry.id)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-gray-50"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        {isExpanded ? "Cancel" : "Update"}
                      </button>
                    )}
                    {entry.pipelineStage === "connected" && (
                      <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        <CheckCircle className="h-3.5 w-3.5" />
                        Connected
                      </div>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 rounded-[20px] border border-gray-200 bg-[#fbfbfc] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Log update</p>
                    <textarea
                      value={actionNote}
                      onChange={(e) => setActionNote(e.target.value)}
                      placeholder="Optional note (e.g. 'texted Sunday evening, no reply yet')"
                      rows={2}
                      className="mt-3 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-gray-400 hover:border-gray-300 focus:border-slate-900"
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {entry.pipelineStage === "new" && (
                        <ActionButton label="Mark contacted" color="blue" onClick={() => advanceStage(entry.id, "contacted")} />
                      )}
                      {(entry.pipelineStage === "new" || entry.pipelineStage === "contacted") && (
                        <ActionButton label="Mark returned" color="violet" onClick={() => advanceStage(entry.id, "returned")} />
                      )}
                      {entry.pipelineStage !== "connected" && (
                        <ActionButton label="Mark connected" color="green" onClick={() => advanceStage(entry.id, "connected")} />
                      )}
                      <ActionButton label="Move to inactive" color="gray" onClick={() => moveToInactive(entry.id)} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function FilterPill({
  label,
  active,
  onClick,
  count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-gray-200 bg-white text-slate-700 hover:bg-gray-50",
      ].join(" ")}
    >
      {label}
      {count !== undefined && (
        <span className={["rounded-full px-1.5 py-0.5 text-xs", active ? "bg-slate-700 text-white" : "bg-gray-100 text-gray-500"].join(" ")}>
          {count}
        </span>
      )}
    </button>
  );
}

function ActionButton({
  label,
  color,
  onClick,
}: {
  label: string;
  color: "blue" | "violet" | "green" | "gray";
  onClick: () => void;
}) {
  const styles = {
    blue:   "bg-[#2563eb] text-white hover:bg-[#1d4ed8]",
    violet: "bg-violet-600 text-white hover:bg-violet-700",
    green:  "bg-emerald-600 text-white hover:bg-emerald-700",
    gray:   "border border-gray-200 bg-white text-slate-600 hover:bg-gray-50",
  };
  return (
    <button
      onClick={onClick}
      className={["inline-flex h-9 items-center rounded-2xl px-4 text-sm font-semibold transition", styles[color]].join(" ")}
    >
      {label}
    </button>
  );
}
