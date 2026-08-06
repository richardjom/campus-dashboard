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
  const allPeople: PcoRawPerson[] = [];
  let page = 0;
  let total: number | null = null;
  let nextPageUrl: string | null | undefined;

  onProgress?.({
    loaded: 0,
    total: null,
    page: 0,
    pageCount: null,
    message: "Connecting to Planning Center…",
  });

  do {
    page += 1;

    onProgress?.({
      loaded: allPeople.length,
      total,
      page: Math.max(1, page),
      pageCount: total && total > 0 ? Math.ceil(total / 100) : null,
      message: page === 1 ? "Loading first Planning Center page…" : `Loading page ${page} from Planning Center…`,
    });

    const res = await fetch("/api/planning-center/people", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...credentials,
        pageUrl: nextPageUrl ?? undefined,
      }),
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({ error: `Planning Center proxy error: ${res.status}` })) as { error?: string };
      throw new Error(payload.error ?? `Planning Center proxy error: ${res.status}`);
    }

    const payload = await res.json() as {
      data?: PcoRawPerson[];
      meta?: {
        total?: number;
        count?: number;
        nextPageUrl?: string | null;
      };
    };

    const people = payload.data ?? [];
    total = typeof payload.meta?.total === "number" ? payload.meta.total : total;
    nextPageUrl = payload.meta?.nextPageUrl ?? null;
    allPeople.push(...people);

    const pageCount = total && total > 0 ? Math.ceil(total / 100) : null;
    onProgress?.({
      loaded: allPeople.length,
      total,
      page,
      pageCount,
      message: nextPageUrl
        ? `Loaded page ${page}${pageCount ? ` of ${pageCount}` : ""} from Planning Center…`
        : "Import complete.",
    });
  } while (nextPageUrl);

  return allPeople;
}
