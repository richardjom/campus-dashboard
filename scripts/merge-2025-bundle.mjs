#!/usr/bin/env node
// Parses the 2025 Campuses Dashboard CSV files and merges them into the preloaded bundle JSON.
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const csvDir = resolve(process.env.HOME, "Downloads");
const bundlePath = resolve("src/data/preloaded-campus-bundle.json");

const files = [
  { name: "2025_Campuses Dashboard(Attendance).csv",    field: "attendance" },
  { name: "2025_Campuses Dashboard(Kids ).csv",         field: "kids" },
  { name: "2025_Campuses Dashboard(First Timers ).csv", field: "first_time_guests" },
  { name: "2025_Campuses Dashboard(Salvations).csv",    field: "salvations" },
  { name: "2025_Campuses Dashboard(Growth Track).csv",  field: "growth_track" },
  { name: "2025_Campuses Dashboard(Baptisms ).csv",     field: "baptism" },
  { name: "2025_Campuses Dashboard(Sunday - Dream Team ).csv", field: "volunteers" },
];

const merged = new Map();
const eventNotes = new Map(); // service_date -> note (from row above WEEKLY)

for (const { name, field } of files) {
  const path = resolve(csvDir, name);
  let text;
  try {
    text = readFileSync(path, "utf-8");
  } catch {
    console.warn(`Skipping ${name} — not found at ${path}`);
    continue;
  }

  const rows = parseDelimited(text);
  const weeklyIdx = rows.findIndex((r) => r[0]?.trim().toUpperCase() === "WEEKLY");
  if (weeklyIdx === -1) {
    console.warn(`Skipping ${name} — no WEEKLY header found`);
    continue;
  }

  const weeklyRow = rows[weeklyIdx];
  const annotationRow = weeklyIdx > 0 ? rows[weeklyIdx - 1] : null;
  const dateColumns = weeklyRow
    .map((cell, i) => ({ i, value: cell.trim() }))
    .filter((e) => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(e.value));

  // Capture event annotations from the row above the dates
  if (annotationRow) {
    for (const { i, value } of dateColumns) {
      const note = (annotationRow[i] ?? "").trim();
      if (note) {
        const iso = toIso(value);
        if (!eventNotes.has(iso)) {
          eventNotes.set(iso, note);
        }
      }
    }
  }

  let campusCount = 0;
  for (let ri = weeklyIdx + 1; ri < rows.length; ri++) {
    const row = rows[ri];
    const campus = row[0]?.trim();
    if (!campus) continue;
    const lower = campus.toLowerCase();
    if (["total", "% swing", "monthly", "quarter"].includes(lower)) break;

    for (const { i, value } of dateColumns) {
      const raw = (row[i] ?? "").replace(/,/g, "").trim();
      if (!raw || raw === "-") continue;
      const num = Number(raw);
      if (!Number.isFinite(num)) continue;

      const serviceDate = toIso(value);
      const key = `${serviceDate}-${campus}`;
      const existing = merged.get(key) ?? {
        id: key,
        service_date: serviceDate,
        campus,
        attendance: 0, volunteers: 0, first_time_guests: 0,
        salvations: 0, kids: 0, growth_track: 0, baptism: 0, notes: "",
      };
      existing[field] = num;
      merged.set(key, existing);
    }
    campusCount++;
  }
  console.log(`✓ ${name} → ${field} (${campusCount} campuses, ${dateColumns.length} dates)`);
}

// We don't have a separate volunteers CSV — the Kids CSV has a "Dream Team" equivalent
// but actually the user uploaded Kids, not Dream Team. We'll leave volunteers at 0 for 2025
// unless there's data elsewhere. The dashboard will still work.

// Apply event notes to all records for that date
for (const record of merged.values()) {
  const note = eventNotes.get(record.service_date);
  if (note) record.notes = note;
}

// Load existing bundle (2026 data) and merge
const existing = JSON.parse(readFileSync(bundlePath, "utf-8"));
const newRecords = Array.from(merged.values()).sort((a, b) => {
  if (a.service_date === b.service_date) return a.campus.localeCompare(b.campus);
  return a.service_date.localeCompare(b.service_date);
});

// Filter existing to only non-2025 to avoid duplicates
const existingFiltered = existing.filter((r) => !r.service_date.startsWith("2025-"));
const combined = [...existingFiltered, ...newRecords].sort((a, b) => {
  if (a.service_date === b.service_date) return a.campus.localeCompare(b.campus);
  return a.service_date.localeCompare(b.service_date);
});

writeFileSync(bundlePath, JSON.stringify(combined, null, 2) + "\n");
console.log(`\nMerged ${newRecords.length} records for 2025 into bundle (${combined.length} total records)`);
console.log(`Captured ${eventNotes.size} event annotation${eventNotes.size === 1 ? "" : "s"}: ${Array.from(eventNotes.entries()).map(([d, n]) => `${d} (${n})`).join(", ")}`);

// --- helpers ---

function parseDelimited(text) {
  const rows = [];
  let cell = "", row = [], inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') { cell += '"'; i++; }
      else inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) { row.push(cell); cell = ""; continue; }
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
      continue;
    }
    cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function toIso(usDate) {
  const [m, d, y] = usDate.split("/");
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}
