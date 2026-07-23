import { useState, useEffect } from "react";
import { CheckCircle, XCircle, Loader, Link2, Trash2, Users } from "lucide-react";
import {
  loadPcoCredentials,
  savePcoCredentials,
  clearPcoCredentials,
  loadPcoImportSummary,
  savePcoImportSummary,
  clearPcoImportSummary,
  testPcoConnection,
  fetchPcoPeople,
  type PcoImportProgress,
  type PcoImportSummary,
  type PcoCredentials,
} from "../lib/planning-center";
import { importPcopeople, savePeople, loadPeople } from "../lib/people";

type ConnectionStatus = "idle" | "testing" | "ok" | "error";
type ImportStatus = "idle" | "importing" | "done" | "error";

const initialImportProgress: PcoImportProgress = {
  loaded: 0,
  total: null,
  page: 0,
  pageCount: null,
  message: "",
};

export function SettingsPage() {
  const [credentials, setCredentials] = useState<PcoCredentials>({ appId: "", secret: "" });
  const [savedCredentials, setSavedCredentials] = useState<PcoCredentials | null>(null);
  const [importSummary, setImportSummary] = useState<PcoImportSummary | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [connectionError, setConnectionError] = useState("");
  const [importStatus, setImportStatus] = useState<ImportStatus>("idle");
  const [importProgress, setImportProgress] = useState<PcoImportProgress>(initialImportProgress);
  const [importError, setImportError] = useState("");
  const [peopleCount, setPeopleCount] = useState(0);

  useEffect(() => {
    const saved = loadPcoCredentials();
    if (saved) setSavedCredentials(saved);
    setImportSummary(loadPcoImportSummary());
    setPeopleCount(loadPeople().filter((p) => p.source === "pco").length);
  }, []);

  const handleTest = async () => {
    setConnectionStatus("testing");
    setConnectionError("");
    const result = await testPcoConnection(credentials);
    if (result.ok) {
      setConnectionStatus("ok");
    } else {
      setConnectionStatus("error");
      setConnectionError(result.error ?? "Connection failed.");
    }
  };

  const handleSave = async () => {
    await handleTest();
    if (connectionStatus === "error") return;
    savePcoCredentials(credentials);
    setSavedCredentials(credentials);
  };

  const handleSaveAndImport = async () => {
    setConnectionStatus("testing");
    const result = await testPcoConnection(credentials);
    if (!result.ok) {
      setConnectionStatus("error");
      setConnectionError(result.error ?? "Connection failed.");
      return;
    }
    setConnectionStatus("ok");
    savePcoCredentials(credentials);
    setSavedCredentials(credentials);
    await runImport(credentials);
  };

  const runImport = async (creds: PcoCredentials) => {
    setImportStatus("importing");
    setImportError("");
    setImportProgress({
      loaded: 0,
      total: null,
      page: 0,
      pageCount: null,
      message: "Connecting to Planning Center…",
    });
    try {
      const rawPeople = await fetchPcoPeople(creds, (progress) => {
        setImportProgress(progress);
      });
      const merged = importPcopeople(rawPeople);
      const summary = {
        importedCount: rawPeople.length,
        lastSyncedAt: new Date().toISOString(),
        preview: rawPeople.slice(0, 5).map((person) => ({
          id: person.id,
          firstName: person.firstName,
          lastName: person.lastName,
          email: person.email,
          membership: person.membership,
        })),
      } satisfies PcoImportSummary;
      savePeople(merged);
      savePcoImportSummary(summary);
      setImportSummary(summary);
      setPeopleCount(merged.filter((p) => p.source === "pco").length);
      setImportStatus("done");
      if (rawPeople.length === 0) {
        setImportError("Planning Center returned 0 people for this import.");
      }
    } catch (err) {
      setImportStatus("error");
      setImportError(err instanceof Error ? err.message : "Import failed.");
    }
  };

  const handleDisconnect = () => {
    clearPcoCredentials();
    clearPcoImportSummary();
    setSavedCredentials(null);
    setImportSummary(null);
    setConnectionStatus("idle");
    setCredentials({ appId: "", secret: "" });
  };

  const importHint = (() => {
    if (importStatus === "done" && importSummary?.importedCount === 0) {
      return "The connection worked, but Planning Center returned no people. This can happen when the account has no accessible people records or the token lacks the expected People access.";
    }
    if (importError.includes("401") || importError.toLowerCase().includes("invalid")) {
      return "Planning Center rejected the credentials. Double-check that the client ID and secret belong to the same Personal Access Token.";
    }
    if (importError.toLowerCase().includes("proxy")) {
      return "The app could not reach the local import bridge. Refresh the app, and if needed restart the local dev server.";
    }
    if (importError.toLowerCase().includes("network") || importError.toLowerCase().includes("reach")) {
      return "The app reached the local bridge, but the bridge could not reach Planning Center. Check your internet connection and try again.";
    }
    if (importError.toLowerCase().includes("500") || importError.toLowerCase().includes("502") || importError.toLowerCase().includes("503")) {
      return "Planning Center or the local bridge returned a server error. Wait a moment and try the import again.";
    }
    return "The import did not finish cleanly. Try testing the connection first, then run the import again.";
  })();

  const formatDateTime = (iso: string) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));

  const importPercent =
    importProgress.total && importProgress.total > 0
      ? Math.max(6, Math.min(100, Math.round((importProgress.loaded / importProgress.total) * 100)))
      : null;

  return (
    <div className="space-y-6 lg:space-y-8">
      <section className="rounded-[30px] border border-gray-200 bg-white p-6 lg:p-7">
        <p className="text-sm font-medium text-gray-500">Workspace</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.06em] text-slate-950 sm:text-5xl">Settings</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-gray-600">
          Connect to Planning Center to import your people directory directly — no CSV export needed. For personal use,
          this flow works with your Planning Center Personal Access Token client ID and secret, without requiring an
          OAuth app.
        </p>
      </section>

      {/* Planning Center connection */}
      <section className="rounded-[30px] border border-gray-200 bg-white p-6 lg:p-7">
        <div className="flex items-start gap-4 border-b border-gray-200 pb-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eff6ff] text-[#2563eb]">
            <Link2 className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950">Planning Center</h2>
            <p className="mt-1 text-sm text-gray-500">
              Connect via a Personal Access Token from your PCO developer account.
            </p>
          </div>
          {savedCredentials && (
            <div className="ml-auto flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <CheckCircle className="h-3.5 w-3.5" />
              Connected
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <InfoCard
              title="How to get your credentials"
              body="In your Planning Center developer account, create a Personal Access Token and copy its client ID and secret into this form."
            />
            <InfoCard
              title="What gets imported"
              body="Active people with names, emails, phone numbers, and PCO membership status. We map their membership type to journey stages automatically."
            />
            <InfoCard
              title="Privacy"
              body="Credentials are stored only in your browser for convenience and are sent only to this local app server so it can call Planning Center securely on your behalf."
            />
          </div>

          <div className="space-y-4">
            {savedCredentials ? (
              <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Active connection</p>
                    <p className="mt-2 text-sm font-semibold text-emerald-900">
                      Client ID: {savedCredentials.appId.slice(0, 8)}••••
                    </p>
                    {peopleCount > 0 && (
                      <p className="mt-1 text-sm text-emerald-700">
                        {peopleCount.toLocaleString()} people imported from PCO
                      </p>
                    )}
                    {importSummary && (
                      <p className="mt-1 text-sm text-emerald-700">
                        Last sync: {formatDateTime(importSummary.lastSyncedAt)}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleDisconnect}
                    className="inline-flex h-9 items-center gap-2 rounded-full border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Disconnect
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    onClick={() => runImport(savedCredentials)}
                    disabled={importStatus === "importing"}
                    className="inline-flex h-10 items-center gap-2 rounded-2xl bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-60"
                  >
                    {importStatus === "importing" ? (
                      <><Loader className="h-4 w-4 animate-spin" /> Importing…</>
                    ) : (
                      <><Users className="h-4 w-4" /> Re-import people</>
                    )}
                  </button>
                </div>

                {importSummary && (
                  <div className="mt-4 rounded-[20px] border border-emerald-200 bg-white/80 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Import audit</p>
                        <p className="mt-1 text-sm font-semibold text-emerald-950">
                          {importSummary.importedCount.toLocaleString()} Planning Center people imported
                        </p>
                        <p className="mt-1 text-xs text-emerald-700">
                          Synced {formatDateTime(importSummary.lastSyncedAt)}
                        </p>
                      </div>
                      <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        Live directory ready
                      </div>
                    </div>

                    {importSummary.preview.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Preview</p>
                        <div className="mt-2 space-y-2">
                          {importSummary.preview.map((person) => (
                            <div
                              key={person.id}
                              className="flex items-center justify-between gap-4 rounded-2xl border border-emerald-100 bg-white px-3 py-2"
                            >
                              <div>
                                <p className="text-sm font-semibold text-slate-950">
                                  {person.firstName} {person.lastName}
                                </p>
                                <p className="text-xs text-gray-500">{person.email || "No email on file"}</p>
                              </div>
                              <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                                {person.membership || "Unclassified"}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4 rounded-[24px] border border-gray-200 bg-[#fbfbfc] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Connect Planning Center</p>

                <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                  Personal Access Token Client ID
                  <input
                    type="text"
                    value={credentials.appId}
                    onChange={(e) => setCredentials((c) => ({ ...c, appId: e.target.value }))}
                    placeholder="Your PCO PAT client ID"
                    className="h-11 rounded-2xl border border-gray-200 bg-white px-4 text-sm font-medium normal-case tracking-normal text-slate-900 outline-none transition placeholder:text-gray-400 hover:border-gray-300 focus:border-slate-900"
                  />
                </label>

                <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                  Personal Access Token Secret
                  <input
                    type="password"
                    value={credentials.secret}
                    onChange={(e) => setCredentials((c) => ({ ...c, secret: e.target.value }))}
                    placeholder="Your PCO PAT secret"
                    className="h-11 rounded-2xl border border-gray-200 bg-white px-4 text-sm font-medium normal-case tracking-normal text-slate-900 outline-none transition placeholder:text-gray-400 hover:border-gray-300 focus:border-slate-900"
                  />
                </label>

                {connectionStatus === "error" && (
                  <div className="flex items-start gap-3 rounded-[20px] border border-rose-200 bg-rose-50 p-3">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                    <p className="text-sm text-rose-700">{connectionError}</p>
                  </div>
                )}

                {connectionStatus === "ok" && (
                  <div className="flex items-center gap-3 rounded-[20px] border border-emerald-200 bg-emerald-50 p-3">
                    <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                    <p className="text-sm font-semibold text-emerald-700">Connected successfully</p>
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleTest}
                    disabled={!credentials.appId || !credentials.secret || connectionStatus === "testing"}
                    className="inline-flex h-10 items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 text-sm font-semibold text-slate-900 transition hover:bg-gray-50 disabled:opacity-50"
                  >
                    {connectionStatus === "testing" ? <Loader className="h-4 w-4 animate-spin" /> : null}
                    Test connection
                  </button>
                  <button
                    onClick={handleSaveAndImport}
                    disabled={!credentials.appId || !credentials.secret || connectionStatus === "testing" || importStatus === "importing"}
                    className="inline-flex h-10 items-center gap-2 rounded-2xl bg-[#2563eb] px-4 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] disabled:opacity-50"
                  >
                    {importStatus === "importing" ? <Loader className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                    {importStatus === "importing" ? "Importing…" : "Connect & import people"}
                  </button>
                </div>
              </div>
            )}

            {importStatus === "importing" && (
              <div className="rounded-[24px] border border-[#dbeafe] bg-[#eff6ff] p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-[#1e3a8a]">
                      {importProgress.message || "Importing people…"}
                    </p>
                    <p className="mt-1 text-sm text-[#1d4ed8]">
                      {importProgress.total && importProgress.total > 0
                        ? `Loaded ${importProgress.loaded.toLocaleString()} of ${importProgress.total.toLocaleString()} people`
                        : `Loaded ${importProgress.loaded.toLocaleString()} people so far`}
                    </p>
                    {(importProgress.page > 0 || importProgress.pageCount) && (
                      <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-[#3b82f6]">
                        {importProgress.pageCount
                          ? `Page ${importProgress.page} of ${importProgress.pageCount}`
                          : `Page ${importProgress.page}`}
                      </p>
                    )}
                  </div>
                  <Loader className="h-5 w-5 shrink-0 animate-spin text-[#2563eb]" />
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#bfdbfe]">
                  <div
                    className={[
                      "h-2 rounded-full bg-[#2563eb] transition-all",
                      importPercent === null ? "animate-pulse" : "",
                    ].join(" ")}
                    style={{ width: importPercent === null ? "38%" : `${importPercent}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-[#1d4ed8]">
                  Preview people will appear here as soon as the import finishes.
                </p>
              </div>
            )}

            {importStatus === "done" && (
              <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <p className="text-sm font-semibold text-emerald-700">
                    Import complete — {peopleCount.toLocaleString()} people loaded into your directory.
                  </p>
                </div>
                {importSummary && (
                  <p className="mt-2 text-sm text-emerald-700">
                    Last synced {formatDateTime(importSummary.lastSyncedAt)}.
                  </p>
                )}
                {importSummary?.importedCount === 0 && (
                  <div className="mt-3 rounded-[20px] border border-amber-200 bg-amber-50 p-3">
                    <p className="text-sm font-semibold text-amber-800">Planning Center returned 0 people.</p>
                    <p className="mt-1 text-sm text-amber-700">{importHint}</p>
                  </div>
                )}
              </div>
            )}

            {importStatus === "error" && (
              <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-4">
                <div className="flex items-start gap-3">
                  <XCircle className="mt-0.5 h-4 w-4 text-rose-500" />
                  <div>
                    <p className="text-sm font-semibold text-rose-700">{importError}</p>
                    <p className="mt-1 text-sm text-rose-700">{importHint}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Campus & org config placeholder */}
      <section className="rounded-[30px] border border-gray-200 bg-white p-6 lg:p-7">
        <h2 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950">Organization</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-500">
          Campus configuration, default import settings, and role management will live here.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <InfoCard title="Church name" body="Set your organization display name for exports and reports." />
          <InfoCard title="Campuses" body="Define campus names that match your PCO or CSV import data." />
          <InfoCard title="Roles" body="Assign dashboard access levels — admin, pastor, campus lead." />
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
