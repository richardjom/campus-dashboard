#!/usr/bin/env node
import { basename, resolve } from "path";
import { readFileSync, writeFileSync } from "fs";

const bundlePath = resolve("src/data/preloaded-campus-bundle.json");
const filePaths = process.argv.slice(2);

if (filePaths.length === 0) {
  console.error("Usage: node scripts/merge-experience-summary-bundle.mjs <csv-file> [more-files...]");
  process.exit(1);
}

const existingBundle = JSON.parse(readFileSync(bundlePath, "utf8"));
const merged = new Map(existingBundle.map((record) => [getMergeKey(record), record]));

let importedRecordCount = 0;
const importedYears = new Set();
const summaries = [];

for (const filePath of filePaths) {
  const csvText = readFileSync(filePath, "utf8");
  const records = parseExperienceSummaryCsv(csvText);

  if (!records || records.length === 0) {
    console.warn(`Skipping ${basename(filePath)} — no legacy experience-summary records were parsed.`);
    continue;
  }

  for (const record of records) {
    merged.set(getMergeKey(record), record);
    importedRecordCount += 1;
    importedYears.add(record.service_date.slice(0, 4));
  }

  summaries.push(`${basename(filePath)} -> ${records.length} records`);
}

const combined = Array.from(merged.values()).sort((left, right) => {
  if (left.service_date === right.service_date) {
    if (left.campus === right.campus) {
      return (left.service_time ?? "").localeCompare(right.service_time ?? "");
    }

    return left.campus.localeCompare(right.campus);
  }

  return left.service_date.localeCompare(right.service_date);
});

writeFileSync(bundlePath, `${JSON.stringify(combined, null, 2)}\n`);

console.log(summaries.join("\n"));
console.log(`\nUpdated bundle with ${importedRecordCount} legacy service records.`);
console.log(`Years present after merge: ${[...new Set(combined.map((record) => record.service_date.slice(0, 4)))].sort().join(", ")}`);
if (importedYears.size > 0) {
  console.log(`Imported years in this run: ${[...importedYears].sort().join(", ")}`);
}

function parseExperienceSummaryCsv(csvText) {
  const rows = parseDelimitedText(csvText).filter((row) => row.some((cell) => cell.trim() !== ""));

  if (rows.length < 3) {
    return null;
  }

  const headerRow = rows[0];
  const dateColumns = headerRow
    .map((cell, columnIndex) => ({
      columnIndex,
      value: cell.trim(),
    }))
    .filter((entry) => isUsDate(entry.value));

  if (dateColumns.length < 4) {
    return null;
  }

  const campus = normalizeLegacyCampusName(headerRow[0] ?? "");

  if (!campus) {
    return null;
  }

  const mergedRecords = new Map();
  let currentServiceTime;
  let recognizedMetricCount = 0;

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const label = row[0]?.trim();

    if (!label) {
      continue;
    }

    if (label.toUpperCase() === "TOTALS") {
      currentServiceTime = undefined;
      continue;
    }

    if (isExperienceServiceLabel(label)) {
      currentServiceTime = normalizeLegacyServiceTime(label);

      dateColumns.forEach(({ columnIndex, value }) => {
        const note = (row[columnIndex] ?? "").trim();

        if (!note || !currentServiceTime) {
          return;
        }

        const serviceDate = toIsoDate(value);
        const key = [serviceDate, campus, currentServiceTime].join("|");
        const existing = mergedRecords.get(key) ?? createEmptyMetricRecord(serviceDate, campus, currentServiceTime);
        existing.notes = appendMetricNote(existing.notes, `${currentServiceTime}: ${note}`);
        mergedRecords.set(key, existing);
      });

      continue;
    }

    const metricField = inferExperienceSummaryMetricField(label);

    if (!metricField || !currentServiceTime) {
      continue;
    }

    recognizedMetricCount += 1;

    dateColumns.forEach(({ columnIndex, value }) => {
      const rawValue = (row[columnIndex] ?? "").replace(/,/g, "").trim();

      if (!rawValue) {
        return;
      }

      const metricValue = Number(rawValue);

      if (!Number.isFinite(metricValue)) {
        return;
      }

      const serviceDate = toIsoDate(value);
      const key = [serviceDate, campus, currentServiceTime].join("|");
      const existing = mergedRecords.get(key) ?? createEmptyMetricRecord(serviceDate, campus, currentServiceTime);
      existing[metricField] += metricValue;
      existing.available_metrics = Array.from(new Set([...(existing.available_metrics ?? []), metricField]));
      mergedRecords.set(key, existing);
    });
  }

  if (recognizedMetricCount === 0) {
    return null;
  }

  return Array.from(mergedRecords.values())
    .filter((record) => {
      const totals =
        record.attendance +
        record.volunteers +
        record.first_time_guests +
        record.salvations +
        record.kids +
        record.growth_track +
        record.baptism;
      return totals > 0 || record.notes.trim() !== "";
    })
    .sort((left, right) => {
      if (left.service_date === right.service_date) {
        if (left.campus === right.campus) {
          return (left.service_time ?? "").localeCompare(right.service_time ?? "");
        }

        return left.campus.localeCompare(right.campus);
      }

      return left.service_date.localeCompare(right.service_date);
    });
}

function parseDelimitedText(text) {
  const rows = [];
  let currentRow = [];
  let currentValue = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        currentValue += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      currentRow.push(currentValue);
      currentValue = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }

      currentRow.push(currentValue);
      rows.push(currentRow);
      currentRow = [];
      currentValue = "";
      continue;
    }

    currentValue += character;
  }

  if (currentValue || currentRow.length > 0) {
    currentRow.push(currentValue);
    rows.push(currentRow);
  }

  return rows;
}

function isUsDate(value) {
  return /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value);
}

function toIsoDate(value) {
  const [month, day, year] = value.split("/");
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function createEmptyMetricRecord(serviceDate, campus, serviceTime) {
  return {
    id: [serviceDate, campus, serviceTime ?? ""].join("|"),
    service_date: serviceDate,
    campus,
    service_time: serviceTime,
    attendance: 0,
    volunteers: 0,
    first_time_guests: 0,
    salvations: 0,
    kids: 0,
    growth_track: 0,
    baptism: 0,
    notes: "",
    available_metrics: [],
  };
}

function isExperienceServiceLabel(label) {
  return /experience/i.test(label);
}

function normalizeLegacyServiceTime(label) {
  const trimmed = label.trim();
  const match = trimmed.match(/(\d{1,2})(?::(\d{2}))?\s*(a|am|p|pm)\b/i);

  if (!match) {
    return trimmed;
  }

  const [, hourValue, minuteValue = "00", meridiemValue] = match;
  const meridiem = meridiemValue.toUpperCase().startsWith("A") ? "AM" : "PM";
  return minuteValue === "00" ? `${Number(hourValue)}${meridiem}` : `${Number(hourValue)}:${minuteValue}${meridiem}`;
}

function inferExperienceSummaryMetricField(label) {
  const normalized = normalizeHeader(label);

  if (normalized === "attendance") {
    return "attendance";
  }

  if (normalized === "baptism") {
    return "baptism";
  }

  if (normalized === "union_kids") {
    return "kids";
  }

  if (normalized === "growth_track") {
    return "growth_track";
  }

  if (normalized === "salvations") {
    return "salvations";
  }

  if (normalized === "first_timers") {
    return "first_time_guests";
  }

  if (normalized === "dream_teamers") {
    return "volunteers";
  }

  return null;
}

function normalizeHeader(header) {
  return header
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^\w]/g, "");
}

function normalizeLegacyCampusName(value) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  const aliases = {
    BWI: "BWI",
    CLT: "North Meck",
    CHARLOTTE: "North Meck",
    COLUMBIA: "Columbia",
    BALTIMORE: "UBC",
    UBC: "UBC",
    FC: "Falls Church",
    FLOWERS: "Flowers",
    "FALLS CHURCH": "Falls Church",
    "SILVER SPRING": "Silver Spring",
    "SILVER SPRINGS": "Silver Springs",
    "NORTH MECK": "North Meck",
    "MINT HILL": "Mint Hill",
  };

  return (
    aliases[trimmed.toUpperCase()] ??
    trimmed
      .toLowerCase()
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

function appendMetricNote(existing, next) {
  if (!next.trim()) {
    return existing;
  }

  if (!existing.trim()) {
    return next.trim();
  }

  const parts = new Set(
    `${existing} | ${next}`
      .split("|")
      .map((part) => part.trim())
      .filter(Boolean),
  );

  return Array.from(parts).join(" | ");
}

function getMergeKey(metric) {
  return [metric.service_date, metric.campus, metric.service_time ?? ""].join("|");
}
