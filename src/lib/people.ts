import type { PcoRawPerson } from "./planning-center";

export type JourneyStage =
  | "guest"       // first visit only
  | "visitor"     // attended a few times, not committed
  | "regular"     // consistent attender
  | "member"      // official church member
  | "connected"   // in a small group
  | "volunteer"   // serving on a team
  | "leader";     // leading a team or group

export type PipelineStage =
  | "new"         // visited, no follow-up yet
  | "contacted"   // sent a message/call
  | "returned"    // came back for second visit
  | "connected"   // joined a group or team
  | "inactive";   // no response, closed out

export type Person = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  campus: string;
  journeyStage: JourneyStage;
  source: "pco" | "manual" | "csv";
  pcoMembership?: string;
  pcoStatus?: string;
  directoryStatus?: "active" | "inactive" | "archived";
  firstVisitDate?: string;
  lastSeenDate?: string;
  notes: string;
  createdAt: string;
};

export type PipelineEntry = {
  id: string;
  personId: string;
  personName: string;
  campus: string;
  email: string;
  phone: string;
  visitDate: string;
  pipelineStage: PipelineStage;
  lastContactDate?: string;
  assignedTo?: string;
  notes: string;
  createdAt: string;
};

const PEOPLE_KEY = "church-dashboard-people";
const PIPELINE_KEY = "church-dashboard-pipeline";
const DB_NAME = "church-dashboard-db";
const DB_VERSION = 1;
const KV_STORE = "kv";
const PEOPLE_RECORD_KEY = "people";

// --- persistence ---

export async function savePeople(people: Person[]) {
  await writeKvRecord(PEOPLE_RECORD_KEY, people);
  localStorage.removeItem(PEOPLE_KEY);
  window.dispatchEvent(new Event("church-dashboard-people-updated"));
}

export async function loadPeople(): Promise<Person[]> {
  const stored = await readKvRecord<Person[]>(PEOPLE_RECORD_KEY);
  if (Array.isArray(stored)) {
    return stored;
  }

  const raw = localStorage.getItem(PEOPLE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      await writeKvRecord(PEOPLE_RECORD_KEY, parsed);
      localStorage.removeItem(PEOPLE_KEY);
      return parsed;
    }
    return [];
  } catch {
    return [];
  }
}

export function savePipelineEntries(entries: PipelineEntry[]) {
  localStorage.setItem(PIPELINE_KEY, JSON.stringify(entries));
  window.dispatchEvent(new Event("church-dashboard-pipeline-updated"));
}

export function loadPipelineEntries(): PipelineEntry[] {
  const raw = localStorage.getItem(PIPELINE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// --- PCO import ---

const pcoMembershipStageMap: Record<string, JourneyStage> = {
  Member: "member",
  Regular: "regular",
  Visitor: "visitor",
  Volunteer: "volunteer",
  Leader: "leader",
  Attendee: "regular",
  Guest: "guest",
};

export function deriveJourneyStage(pcoMembership: string): JourneyStage {
  const normalized = pcoMembership?.trim();
  const exactMatch = pcoMembershipStageMap[normalized];
  if (exactMatch) return exactMatch;

  const lowered = normalized.toLowerCase();

  if (lowered.includes("leader") || lowered.includes("lead") || lowered.includes("coordinator")) {
    return "leader";
  }

  if (
    lowered.includes("volunteer") ||
    lowered.includes("serve") ||
    lowered.includes("serving") ||
    lowered.includes("dream team")
  ) {
    return "volunteer";
  }

  if (lowered.includes("member")) return "member";
  if (lowered.includes("regular") || lowered.includes("attendee")) return "regular";
  if (lowered.includes("guest")) return "guest";
  if (lowered.includes("visitor")) return "visitor";
  if (lowered.includes("connect")) return "connected";

  return "visitor";
}

export function deriveDirectoryStatus(pcoStatus?: string): "active" | "inactive" | "archived" {
  const normalized = pcoStatus?.trim().toLowerCase();
  if (normalized === "inactive") return "inactive";
  if (normalized === "archived") return "archived";
  return "active";
}

export async function importPcopeople(rawPeople: PcoRawPerson[]): Promise<Person[]> {
  const existing = await loadPeople();
  const existingById = new Map(existing.map((p) => [p.id, p]));

  const imported: Person[] = rawPeople.map((raw) => {
    const existing = existingById.get(`pco-${raw.id}`);
    return {
      id: `pco-${raw.id}`,
      firstName: raw.firstName,
      lastName: raw.lastName,
      email: raw.email,
      phone: raw.phone,
      campus: "",
      journeyStage: existing?.journeyStage ?? deriveJourneyStage(raw.membership),
      source: "pco" as const,
      pcoMembership: raw.membership,
      pcoStatus: raw.status,
      directoryStatus: existing?.directoryStatus ?? deriveDirectoryStatus(raw.status),
      firstVisitDate: existing?.firstVisitDate,
      lastSeenDate: existing?.lastSeenDate,
      notes: existing?.notes ?? "",
      createdAt: raw.createdAt,
    };
  });

  // Merge: keep manual/csv people, replace pco ones
  const nonPco = existing.filter((p) => p.source !== "pco");
  return [...nonPco, ...imported];
}

async function openDashboardDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(KV_STORE)) {
        db.createObjectStore(KV_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open local database."));
  });
}

async function readKvRecord<T>(key: string): Promise<T | null> {
  const db = await openDashboardDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(KV_STORE, "readonly");
    const store = tx.objectStore(KV_STORE);
    const request = store.get(key);

    request.onsuccess = () => {
      const result = request.result;
      resolve(result === undefined ? null : (result as T));
    };
    request.onerror = () => reject(request.error ?? new Error(`Could not read ${key} from local database.`));
    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error ?? new Error(`Could not read ${key} from local database.`));
  });
}

async function writeKvRecord(key: string, value: unknown): Promise<void> {
  const db = await openDashboardDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(KV_STORE, "readwrite");
    const store = tx.objectStore(KV_STORE);
    store.put(value, key);

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error ?? new Error(`Could not save ${key} to local database.`));
  });
}

// --- pipeline helpers ---

export function addGuestToPipeline(person: Person, visitDate: string): PipelineEntry {
  const entry: PipelineEntry = {
    id: `pipeline-${person.id}-${visitDate}`,
    personId: person.id,
    personName: `${person.firstName} ${person.lastName}`,
    campus: person.campus,
    email: person.email,
    phone: person.phone,
    visitDate,
    pipelineStage: "new",
    notes: "",
    createdAt: new Date().toISOString(),
  };
  return entry;
}

export function daysSince(dateStr: string | undefined): number {
  if (!dateStr) return Infinity;
  const then = new Date(dateStr).getTime();
  const now = Date.now();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

export function getPipelineAlerts(entries: PipelineEntry[]): PipelineEntry[] {
  return entries.filter((entry) => {
    if (entry.pipelineStage === "connected" || entry.pipelineStage === "inactive") return false;
    const days = entry.pipelineStage === "new"
      ? daysSince(entry.visitDate)
      : daysSince(entry.lastContactDate);
    return days > 3;
  });
}

// --- journey funnel ---

export type JourneyFunnelRow = {
  stage: JourneyStage;
  label: string;
  count: number;
  color: string;
};

const stageOrder: JourneyStage[] = ["guest", "visitor", "regular", "member", "connected", "volunteer", "leader"];

const stageMeta: Record<JourneyStage, { label: string; color: string }> = {
  guest:     { label: "First-time Guest", color: "#f97316" },
  visitor:   { label: "Visitor",          color: "#facc15" },
  regular:   { label: "Regular",          color: "#38bdf8" },
  member:    { label: "Member",           color: "#2563eb" },
  connected: { label: "Connected",        color: "#7c3aed" },
  volunteer: { label: "Volunteer",        color: "#10b981" },
  leader:    { label: "Team Lead / Coordinator", color: "#0f172a" },
};

export function buildJourneyFunnel(people: Person[]): JourneyFunnelRow[] {
  const counts = new Map<JourneyStage, number>();
  for (const stage of stageOrder) counts.set(stage, 0);
  for (const person of people) {
    counts.set(person.journeyStage, (counts.get(person.journeyStage) ?? 0) + 1);
  }
  return stageOrder.map((stage) => ({
    stage,
    label: stageMeta[stage].label,
    count: counts.get(stage) ?? 0,
    color: stageMeta[stage].color,
  }));
}

export function updatePersonDirectoryStatus(
  people: Person[],
  personId: string,
  directoryStatus: Person["directoryStatus"],
): Person[] {
  return people.map((person) =>
    person.id === personId ? { ...person, directoryStatus } : person,
  );
}

// --- mock seed data ---

export function getMockPeople(): Person[] {
  const now = new Date().toISOString();
  return [
    { id: "m-1",  firstName: "Jordan",   lastName: "Mitchell", email: "jordan.mitchell@email.com",  phone: "555-0101", campus: "North",   journeyStage: "regular",   source: "manual", notes: "", createdAt: now },
    { id: "m-2",  firstName: "Priya",    lastName: "Sharma",   email: "priya.sharma@email.com",     phone: "555-0102", campus: "North",   journeyStage: "volunteer", source: "manual", notes: "", createdAt: now },
    { id: "m-3",  firstName: "Marcus",   lastName: "Green",    email: "marcus.green@email.com",     phone: "555-0103", campus: "South",   journeyStage: "member",    source: "manual", notes: "", createdAt: now },
    { id: "m-4",  firstName: "Chloe",    lastName: "Torres",   email: "chloe.torres@email.com",     phone: "555-0104", campus: "North",   journeyStage: "guest",     source: "manual", notes: "Met at Easter service", createdAt: now, firstVisitDate: "2026-04-20" },
    { id: "m-5",  firstName: "Devon",    lastName: "Clark",    email: "devon.clark@email.com",      phone: "555-0105", campus: "Central", journeyStage: "visitor",   source: "manual", notes: "", createdAt: now },
    { id: "m-6",  firstName: "Aaliyah",  lastName: "Johnson",  email: "aaliyah.j@email.com",        phone: "555-0106", campus: "South",   journeyStage: "connected", source: "manual", notes: "In the Tuesday small group", createdAt: now },
    { id: "m-7",  firstName: "Ryan",     lastName: "Nguyen",   email: "ryan.nguyen@email.com",      phone: "555-0107", campus: "North",   journeyStage: "leader",    source: "manual", notes: "Leads worship team", createdAt: now },
    { id: "m-8",  firstName: "Sofia",    lastName: "Baker",    email: "sofia.baker@email.com",      phone: "555-0108", campus: "Central", journeyStage: "regular",   source: "manual", notes: "", createdAt: now },
    { id: "m-9",  firstName: "Elijah",   lastName: "Wright",   email: "elijah.w@email.com",         phone: "555-0109", campus: "South",   journeyStage: "member",    source: "manual", notes: "", createdAt: now },
    { id: "m-10", firstName: "Nadia",    lastName: "Chen",     email: "nadia.chen@email.com",       phone: "555-0110", campus: "North",   journeyStage: "volunteer", source: "manual", notes: "Kids ministry", createdAt: now },
    { id: "m-11", firstName: "Tyler",    lastName: "Adams",    email: "tyler.adams@email.com",      phone: "555-0111", campus: "Central", journeyStage: "guest",     source: "manual", notes: "", createdAt: now, firstVisitDate: "2026-04-27" },
    { id: "m-12", firstName: "Monique",  lastName: "Harris",   email: "monique.h@email.com",        phone: "555-0112", campus: "South",   journeyStage: "visitor",   source: "manual", notes: "", createdAt: now },
    { id: "m-13", firstName: "Isaiah",   lastName: "Robinson", email: "isaiah.r@email.com",         phone: "555-0113", campus: "North",   journeyStage: "regular",   source: "manual", notes: "", createdAt: now },
    { id: "m-14", firstName: "Camille",  lastName: "Young",    email: "camille.y@email.com",        phone: "555-0114", campus: "Central", journeyStage: "connected", source: "manual", notes: "Wednesday group", createdAt: now },
    { id: "m-15", firstName: "Jaylen",   lastName: "Scott",    email: "jaylen.s@email.com",         phone: "555-0115", campus: "South",   journeyStage: "leader",    source: "manual", notes: "Life group leader", createdAt: now },
    { id: "m-16", firstName: "Hannah",   lastName: "Lewis",    email: "hannah.l@email.com",         phone: "555-0116", campus: "North",   journeyStage: "member",    source: "manual", notes: "", createdAt: now },
    { id: "m-17", firstName: "Darius",   lastName: "Walker",   email: "darius.w@email.com",         phone: "555-0117", campus: "Central", journeyStage: "regular",   source: "manual", notes: "", createdAt: now },
    { id: "m-18", firstName: "Leila",    lastName: "Patel",    email: "leila.p@email.com",          phone: "555-0118", campus: "South",   journeyStage: "volunteer", source: "manual", notes: "Hospitality team", createdAt: now },
    { id: "m-19", firstName: "Connor",   lastName: "Hall",     email: "connor.h@email.com",         phone: "555-0119", campus: "North",   journeyStage: "guest",     source: "manual", notes: "Invited by Marcus", createdAt: now, firstVisitDate: "2026-04-13" },
    { id: "m-20", firstName: "Serena",   lastName: "King",     email: "serena.k@email.com",         phone: "555-0120", campus: "South",   journeyStage: "connected", source: "manual", notes: "", createdAt: now },
  ];
}

export function getMockPipelineEntries(): PipelineEntry[] {
  const now = new Date().toISOString();
  return [
    { id: "pl-1", personId: "m-4",  personName: "Chloe Torres",   campus: "North",   email: "chloe.torres@email.com",  phone: "555-0104", visitDate: "2026-04-20", pipelineStage: "new",       notes: "Easter service visitor", createdAt: now },
    { id: "pl-2", personId: "m-11", personName: "Tyler Adams",    campus: "Central", email: "tyler.adams@email.com",   phone: "555-0111", visitDate: "2026-04-27", pipelineStage: "new",       notes: "", createdAt: now },
    { id: "pl-3", personId: "m-19", personName: "Connor Hall",    campus: "North",   email: "connor.h@email.com",      phone: "555-0119", visitDate: "2026-04-13", pipelineStage: "contacted", lastContactDate: "2026-04-14", notes: "Texted on Monday", createdAt: now },
    { id: "pl-4", personId: "m-5",  personName: "Devon Clark",    campus: "Central", email: "devon.clark@email.com",   phone: "555-0105", visitDate: "2026-04-06", pipelineStage: "contacted", lastContactDate: "2026-04-20", notes: "Called, left voicemail", createdAt: now },
    { id: "pl-5", personId: "m-12", personName: "Monique Harris", campus: "South",   email: "monique.h@email.com",     phone: "555-0112", visitDate: "2026-03-30", pipelineStage: "returned",  lastContactDate: "2026-04-06", notes: "Back for second Sunday!", createdAt: now },
    { id: "pl-6", personId: "m-1",  personName: "Jordan Mitchell",campus: "North",   email: "jordan.mitchell@email.com", phone: "555-0101", visitDate: "2026-03-02", pipelineStage: "connected", lastContactDate: "2026-04-01", notes: "Joined Tuesday group", createdAt: now },
  ];
}
