import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Search, UserPlus, Settings } from "lucide-react";
import {
  loadPeople,
  getMockPeople,
  buildJourneyFunnel,
  savePeople,
  updatePersonDirectoryStatus,
  type Person,
  type JourneyStage,
} from "../lib/people";

const PAGE_SIZE_OPTIONS = [50, 100, 250] as const;
type DirectoryStatusFilter = "active" | "inactive" | "all";

const stageColors: Record<JourneyStage, { bg: string; text: string; dot: string }> = {
  guest:     { bg: "bg-orange-100",  text: "text-orange-700",  dot: "#f97316" },
  visitor:   { bg: "bg-yellow-100",  text: "text-yellow-700",  dot: "#facc15" },
  regular:   { bg: "bg-sky-100",     text: "text-sky-700",     dot: "#38bdf8" },
  member:    { bg: "bg-blue-100",    text: "text-blue-700",    dot: "#2563eb" },
  connected: { bg: "bg-violet-100",  text: "text-violet-700",  dot: "#7c3aed" },
  volunteer: { bg: "bg-emerald-100", text: "text-emerald-700", dot: "#10b981" },
  leader:    { bg: "bg-slate-100",   text: "text-slate-700",   dot: "#0f172a" },
};

const stageLabels: Record<JourneyStage, string> = {
  guest:     "First-time Guest",
  visitor:   "Visitor",
  regular:   "Regular",
  member:    "Member",
  connected: "Connected",
  volunteer: "Volunteer",
  leader:    "Team Lead / Coordinator",
};

const allStages: JourneyStage[] = ["guest", "visitor", "regular", "member", "connected", "volunteer", "leader"];

export function PeoplePage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [source, setSource] = useState<"mock" | "real">("mock");
  const [search, setSearch] = useState("");
  const [activeStage, setActiveStage] = useState<JourneyStage | "all">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStage, setEditStage] = useState<JourneyStage>("visitor");
  const [directoryFilter, setDirectoryFilter] = useState<DirectoryStatusFilter>("active");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(100);

  useEffect(() => {
    const stored = loadPeople();
    if (stored.length > 0) {
      setPeople(stored);
      setSource("real");
    } else {
      setPeople(getMockPeople());
      setSource("mock");
    }

    const onUpdate = () => {
      const updated = loadPeople();
      if (updated.length > 0) {
        setPeople(updated);
        setSource("real");
      }
    };
    window.addEventListener("church-dashboard-people-updated", onUpdate);
    return () => window.removeEventListener("church-dashboard-people-updated", onUpdate);
  }, []);

  const funnel = useMemo(() => buildJourneyFunnel(people), [people]);
  const maxCount = Math.max(...funnel.map((row) => row.count), 1);

  const filtered = useMemo(() => {
    return people.filter((person) => {
      const matchesStage = activeStage === "all" || person.journeyStage === activeStage;
      const personDirectoryStatus = person.directoryStatus ?? "active";
      const matchesDirectory =
        directoryFilter === "all"
          ? true
          : directoryFilter === "inactive"
            ? personDirectoryStatus !== "active"
            : personDirectoryStatus === "active";
      const query = search.toLowerCase();
      const matchesSearch =
        !query ||
        person.firstName.toLowerCase().includes(query) ||
        person.lastName.toLowerCase().includes(query) ||
        person.email.toLowerCase().includes(query) ||
        person.campus.toLowerCase().includes(query) ||
        (person.pcoMembership ?? "").toLowerCase().includes(query) ||
        personDirectoryStatus.toLowerCase().includes(query);
      return matchesStage && matchesDirectory && matchesSearch;
    });
  }, [people, activeStage, directoryFilter, search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, activeStage, directoryFilter, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedPeople = useMemo(() => {
    const startIndex = (safePage - 1) * pageSize;
    return filtered.slice(startIndex, startIndex + pageSize);
  }, [filtered, safePage, pageSize]);

  const pageStart = filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const pageEnd = filtered.length === 0 ? 0 : Math.min(filtered.length, safePage * pageSize);

  const handleStageUpdate = (personId: string) => {
    const updated = people.map((p) =>
      p.id === personId ? { ...p, journeyStage: editStage } : p,
    );
    setPeople(updated);
    savePeople(updated);
    setEditingId(null);
  };

  const handleDirectoryStatusUpdate = (personId: string, nextStatus: "active" | "inactive" | "archived") => {
    const target = people.find((person) => person.id === personId);
    if (!target) return;

    const confirmed = window.confirm(
      nextStatus === "archived"
        ? `Archive ${target.firstName} ${target.lastName}? This removes them from the active directory view without permanently deleting the record.`
        : `Mark ${target.firstName} ${target.lastName} as ${nextStatus}? This changes how they appear in directory filters but does not delete their record.`,
    );

    if (!confirmed) return;

    const updated = updatePersonDirectoryStatus(people, personId, nextStatus);
    setPeople(updated);
    savePeople(updated);
  };

  const directoryCounts = useMemo(() => {
    const counts = { active: 0, inactive: 0, archived: 0 };
    for (const person of people) {
      const status = person.directoryStatus ?? "active";
      counts[status] += 1;
    }
    counts.inactive += counts.archived;
    return counts;
  }, [people]);

  return (
    <div className="space-y-6 lg:space-y-8">
      <section className="rounded-[30px] border border-gray-200 bg-white p-6 lg:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">People directory</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.06em] text-slate-950 sm:text-5xl">
              Journey tracker
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-gray-600">
              See where every person is in their faith journey — from first-time guest to leader. Import from Planning
              Center in Settings to replace the demo data with your real directory.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div
              className={[
                "inline-flex h-12 items-center rounded-2xl border px-4 text-sm font-semibold",
                source === "real"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-gray-200 bg-white text-slate-700",
              ].join(" ")}
            >
              {source === "real" ? "Live directory" : "Demo data"}
            </div>
            <Link
              to="/settings"
              className="inline-flex h-12 items-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 text-sm font-semibold text-slate-900 transition hover:bg-gray-50"
            >
              <Settings className="h-4 w-4" />
              Connect Planning Center
            </Link>
            <Link
              to="/pipeline"
              className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[#2563eb] px-5 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]"
            >
              <UserPlus className="h-4 w-4" />
              Guest pipeline
            </Link>
          </div>
        </div>
      </section>

      {/* Journey funnel */}
      <section className="rounded-[30px] border border-gray-200 bg-white p-6 lg:p-7">
        <div className="border-b border-gray-200 pb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Growth funnel</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">Journey stage breakdown</h2>
          <p className="mt-3 text-sm leading-6 text-gray-600">
            Planning Center memberships containing words like `volunteer`, `serve`, `team lead`, or `coordinator`
            now flow into the serving buckets automatically. You can still reassign any person manually by clicking
            their stage pill in the directory below.
          </p>
        </div>

        <div className="mt-6 space-y-3">
          {funnel.map((row) => (
            <button
              key={row.stage}
              onClick={() => setActiveStage(activeStage === row.stage ? "all" : row.stage)}
              className={[
                "group flex w-full items-center gap-4 rounded-[20px] border p-3 text-left transition",
                activeStage === row.stage
                  ? "border-slate-900 bg-slate-950"
                  : "border-gray-200 bg-[#fbfbfc] hover:border-gray-300 hover:bg-white",
              ].join(" ")}
            >
              <div className="w-36 shrink-0">
                <p className={["text-sm font-semibold", activeStage === row.stage ? "text-white" : "text-slate-950"].join(" ")}>
                  {row.label}
                </p>
                <p className={["text-xs", activeStage === row.stage ? "text-slate-400" : "text-gray-500"].join(" ")}>
                  {row.count} {row.count === 1 ? "person" : "people"}
                </p>
              </div>
              <div className="flex-1">
                <div className="h-3 rounded-full bg-gray-100">
                  <div
                    className="h-3 rounded-full transition-all"
                    style={{
                      width: `${Math.max((row.count / maxCount) * 100, row.count > 0 ? 4 : 0)}%`,
                      backgroundColor: row.color,
                    }}
                  />
                </div>
              </div>
              <div className={["w-16 text-right text-sm font-semibold", activeStage === row.stage ? "text-white" : "text-slate-700"].join(" ")}>
                {people.length > 0 ? `${Math.round((row.count / people.length) * 100)}%` : "—"}
              </div>
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4">
          <p className="text-sm text-gray-500">
            {people.length.toLocaleString()} total people in directory
          </p>
          {activeStage !== "all" && (
            <button
              onClick={() => setActiveStage("all")}
              className="text-sm font-semibold text-[#2563eb] hover:underline"
            >
              Clear filter
            </button>
          )}
        </div>
      </section>

      {/* People list */}
      <section className="rounded-[30px] border border-gray-200 bg-white p-6 lg:p-7">
        <div className="flex flex-col gap-4 border-b border-gray-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Directory</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
              {activeStage === "all" ? "All people" : stageLabels[activeStage]}
              <span className="ml-3 text-lg font-normal text-gray-400">({filtered.length})</span>
            </h2>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search name, email, campus…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-2xl border border-gray-200 bg-[#fbfbfc] pl-10 pr-4 text-sm outline-none transition placeholder:text-gray-400 hover:border-gray-300 focus:border-slate-900 sm:w-64"
            />
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-2 py-4">
          <StageTab label="All" active={activeStage === "all"} onClick={() => setActiveStage("all")} />
          {allStages.map((stage) => (
            <StageTab
              key={stage}
              label={stageLabels[stage]}
              active={activeStage === stage}
              onClick={() => setActiveStage(activeStage === stage ? "all" : stage)}
              color={stageColors[stage].dot}
            />
          ))}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-gray-100 py-4">
          <DirectoryTab
            label={`Active (${directoryCounts.active})`}
            active={directoryFilter === "active"}
            onClick={() => setDirectoryFilter("active")}
          />
          <DirectoryTab
            label={`Inactive (${directoryCounts.inactive})`}
            active={directoryFilter === "inactive"}
            onClick={() => setDirectoryFilter("inactive")}
          />
          <DirectoryTab
            label={`All statuses (${people.length})`}
            active={directoryFilter === "all"}
            onClick={() => setDirectoryFilter("all")}
          />
        </div>

        <div className="flex flex-col gap-3 border-y border-gray-100 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500">
            Showing {pageStart.toLocaleString()}–{pageEnd.toLocaleString()} of {filtered.length.toLocaleString()} people
          </p>
          <label className="flex items-center gap-3 text-sm text-gray-500">
            Rows per page
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number])}
              className="h-10 rounded-2xl border border-gray-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition hover:border-gray-300 focus:border-slate-900"
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="divide-y divide-gray-100">
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-400">No people match that filter.</p>
          )}
          {paginatedPeople.map((person) => (
            <div key={person.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
                  {person.firstName[0]}{person.lastName[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-950">
                    {person.firstName} {person.lastName}
                  </p>
                  <p className="text-sm text-gray-500">
                    {person.email || "—"}
                    {person.campus ? ` · ${person.campus}` : ""}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-600">
                      {(person.directoryStatus ?? "active").replace(/^./, (c) => c.toUpperCase())}
                    </span>
                    {person.pcoMembership && (
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-700">
                        PCO: {person.pcoMembership}
                      </span>
                    )}
                    {person.pcoStatus && (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
                        PCO status: {person.pcoStatus}
                      </span>
                    )}
                  </div>
                  {person.notes && (
                    <p className="mt-1 text-xs text-gray-400">{person.notes}</p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3">
                {editingId === person.id ? (
                  <div className="flex items-center gap-2">
                    <select
                      value={editStage}
                      onChange={(e) => setEditStage(e.target.value as JourneyStage)}
                      className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-slate-900"
                    >
                      {allStages.map((s) => (
                        <option key={s} value={s}>{stageLabels[s]}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleStageUpdate(person.id)}
                      className="h-9 rounded-xl bg-slate-900 px-3 text-xs font-semibold text-white transition hover:bg-slate-800"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="h-9 rounded-xl border border-gray-200 px-3 text-xs font-semibold text-slate-700 transition hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setEditingId(person.id);
                      setEditStage(person.journeyStage);
                    }}
                    className={[
                      "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold transition hover:opacity-80",
                      stageColors[person.journeyStage].bg,
                      stageColors[person.journeyStage].text,
                    ].join(" ")}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: stageColors[person.journeyStage].dot }}
                    />
                    {stageLabels[person.journeyStage]}
                  </button>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {(person.directoryStatus ?? "active") !== "inactive" && (
                    <button
                      onClick={() => handleDirectoryStatusUpdate(person.id, "inactive")}
                      className="inline-flex h-9 items-center rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
                    >
                      Mark inactive
                    </button>
                  )}
                  {(person.directoryStatus ?? "active") !== "active" && (
                    <button
                      onClick={() => handleDirectoryStatusUpdate(person.id, "active")}
                      className="inline-flex h-9 items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                    >
                      Restore active
                    </button>
                  )}
                  {(person.directoryStatus ?? "active") !== "archived" && (
                    <button
                      onClick={() => handleDirectoryStatusUpdate(person.id, "archived")}
                      className="inline-flex h-9 items-center rounded-full border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                    >
                      Archive
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-gray-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500">
            Page {safePage} of {totalPages}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={safePage === 1}
              className="h-10 rounded-2xl border border-gray-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              First
            </button>
            <button
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={safePage === 1}
              className="h-10 rounded-2xl border border-gray-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={safePage === totalPages}
              className="h-10 rounded-2xl border border-gray-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={safePage === totalPages}
              className="h-10 rounded-2xl border border-gray-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Last
            </button>
          </div>
        </div>
        <div className="mt-4 rounded-[22px] border border-gray-200 bg-[#fbfbfc] p-4">
          <p className="text-sm font-semibold text-slate-950">Deletion safety</p>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            This directory now uses an archive-first workflow. Mark people inactive or archived to hide them from active
            reporting without permanently deleting them. Hard delete is intentionally not exposed here yet because it
            should require stronger confirmation and audit controls.
          </p>
        </div>
      </section>
    </div>
  );
}

function StageTab({
  label,
  active,
  onClick,
  color,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-gray-200 bg-white text-slate-700 hover:bg-gray-50",
      ].join(" ")}
    >
      {color && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />}
      {label}
    </button>
  );
}

function DirectoryTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-gray-200 bg-white text-slate-700 hover:bg-gray-50",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
