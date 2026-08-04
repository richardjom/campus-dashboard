// Planning Center Online import client
// Auth: Personal Access Token client_id + secret, sent only to the local app server proxy.

export type PcoCredentials = {
  appId: string;
  secret: string;
};

export type PcoRawPerson = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  membership: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  primaryCampusId: string | null;
  gender: string;
  birthdate: string | null;
};

export type PcoImportSummary = {
  importedCount: number;
  lastSyncedAt: string;
  preview: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    membership: string;
  }>;
};

export type PcoImportProgress = {
  loaded: number;
  total: number | null;
  page: number;
  pageCount: number | null;
  message: string;
};

const CREDENTIALS_KEY = "church-dashboard-pco-credentials";
const IMPORT_SUMMARY_KEY = "church-dashboard-pco-import-summary";

export function savePcoCredentials(credentials: PcoCredentials) {
  localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials));
}

export function loadPcoCredentials(): PcoCredentials | null {
  const raw = localStorage.getItem(CREDENTIALS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PcoCredentials;
  } catch {
    return null;
  }
}

export function clearPcoCredentials() {
  localStorage.removeItem(CREDENTIALS_KEY);
}

export function savePcoImportSummary(summary: PcoImportSummary) {
  localStorage.setItem(IMPORT_SUMMARY_KEY, JSON.stringify(summary));
}

export function loadPcoImportSummary(): PcoImportSummary | null {
  const raw = localStorage.getItem(IMPORT_SUMMARY_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PcoImportSummary;
  } catch {
    return null;
  }
}

export function clearPcoImportSummary() {
  localStorage.removeItem(IMPORT_SUMMARY_KEY);
}

export async function testPcoConnection(credentials: PcoCredentials): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/planning-center/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });
    const payload = await res.json() as { ok?: boolean; error?: string };

    if (res.ok && payload.ok) return { ok: true };
    if (res.status === 401) return { ok: false, error: payload.error ?? "Invalid credentials." };
    return { ok: false, error: payload.error ?? `API returned ${res.status}.` };
  } catch {
    return { ok: false, error: "Could not reach the Planning Center connection service. Refresh the page and try again." };
  }
}

export async function fetchPcoPeople(
  credentials: PcoCredentials,
  onProgress?: (progress: PcoImportProgress) => void,
): Promise<PcoRawPerson[]> {
  const res = await fetch("/api/planning-center/people", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => ({ error: `Planning Center proxy error: ${res.status}` })) as { error?: string };
    throw new Error(payload.error ?? `Planning Center proxy error: ${res.status}`);
  }

  const contentType = res.headers.get("Content-Type") ?? "";
  if (!res.body || !contentType.includes("application/x-ndjson")) {
    const payload = await res.json() as { data: PcoRawPerson[] };
    const people = payload.data ?? [];
    onProgress?.({
      loaded: people.length,
      total: people.length,
      page: 1,
      pageCount: 1,
      message: "Import complete.",
    });
    return people;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let people: PcoRawPerson[] | null = null;

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as
        | ({ type: "progress" } & PcoImportProgress)
        | ({ type: "done"; data: PcoRawPerson[] } & PcoImportProgress)
        | { type: "error"; error: string };

      if (event.type === "error") {
        throw new Error(event.error);
      }

      if (event.type === "progress") {
        onProgress?.(event);
      }

      if (event.type === "done") {
        people = event.data;
        onProgress?.(event);
      }
    }

    if (done) break;
  }

  if (buffer.trim()) {
    const event = JSON.parse(buffer) as
      | ({ type: "done"; data: PcoRawPerson[] } & PcoImportProgress)
      | { type: "error"; error: string };

    if (event.type === "error") {
      throw new Error(event.error);
    }

    people = event.data;
    onProgress?.(event);
  }

  if (!people) {
    throw new Error("Planning Center import ended before any results were returned.");
  }

  return people;
}
