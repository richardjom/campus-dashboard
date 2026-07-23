export type KpiKey = "attendance" | "volunteers" | "firstTimeGuests" | "salvations" | "kids" | "growthTrack" | "baptism";

export type KpiCard = {
  key: KpiKey;
  label: string;
  value: string;
  change: string;
  changeDirection: "up" | "down";
  footnote: string;
  sparkline: number[];
};

export type CampusOption = "North" | "South" | "Central";
export type TimeframeOption = "2024" | "2025" | "2026";

export type ChartPoint = {
  label: string;
  attendance: number;
  volunteers: number;
  firstTimeGuests: number;
  salvations: number;
};

export type Period = {
  year: string;
  quarter?: number; // 1-4 or undefined for full year
  month?: number;   // 1-12 or undefined for full quarter/year
};

export type ComparisonFilters = {
  selectedCampuses: string[];
  metric: KpiKey;
  periodA: Period;
  periodB?: Period; // optional comparison period
  comparisonPeriods?: Period[]; // optional additional comparison periods for multi-year overlays
};

// Keep legacy alias for files that haven't migrated yet
export type LegacyComparisonFilters = {
  selectedCampuses: string[];
  timeframe: string;
  metric: KpiKey;
};

export type CampusSnapshot = {
  campus: string;
  attendance: number;
  volunteers: number;
  firstTimeGuests: number;
  salvations: number;
  status: "Growing" | "Stable" | "Needs follow-up";
};

export type ExportRecord = {
  title: string;
  format: "CSV" | "Brief";
  timeframe: TimeframeOption;
  campuses: string;
  createdAt: string;
  status: "Ready" | "Queued";
};

export const campusOptions: CampusOption[] = ["North", "South", "Central"];
export const timeframeOptions: TimeframeOption[] = ["2024", "2025", "2026"];
export const metricOptions: Array<{ key: KpiKey; label: string }> = [
  { key: "attendance", label: "Attendance" },
  { key: "volunteers", label: "Volunteers" },
  { key: "firstTimeGuests", label: "First-Time Guests" },
  { key: "salvations", label: "Salvations" },
  { key: "kids", label: "Kids" },
  { key: "growthTrack", label: "Growth Track" },
  { key: "baptism", label: "Baptism" },
];
const comparisonMonthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const navigationItems = [
  { label: "Dashboard", href: "/dashboard", group: "Workspace" },
  { label: "Sunday Entry", href: "/entry", group: "Workspace" },
  { label: "People", href: "/people", group: "Growth" },
  { label: "Pipeline", href: "/pipeline", group: "Growth" },
  { label: "Historical Data", href: "/records", group: "Analysis" },
  { label: "Reports", href: "/insights", group: "Analysis" },
  { label: "Settings", href: "/settings", group: "Admin" },
];

export const kpiCards: KpiCard[] = [
  {
    key: "attendance",
    label: "Weekly attendance",
    value: "1,284",
    change: "+12%",
    changeDirection: "up",
    footnote: "vs last Sunday",
    sparkline: [840, 902, 918, 961, 994, 1022, 1080, 1104, 1142, 1191, 1230, 1284],
  },
  {
    key: "volunteers",
    label: "Volunteer coverage",
    value: "214",
    change: "+6%",
    changeDirection: "up",
    footnote: "all teams assigned",
    sparkline: [162, 168, 171, 175, 179, 181, 187, 193, 195, 201, 207, 214],
  },
  {
    key: "firstTimeGuests",
    label: "First-time guests",
    value: "47",
    change: "-4%",
    changeDirection: "down",
    footnote: "watch follow-up rate",
    sparkline: [58, 60, 57, 56, 54, 53, 55, 52, 50, 48, 49, 47],
  },
  {
    key: "salvations",
    label: "Salvations",
    value: "19",
    change: "+19%",
    changeDirection: "up",
    footnote: "strongest this quarter",
    sparkline: [8, 9, 10, 11, 12, 11, 13, 14, 15, 16, 18, 19],
  },
];

export const chartDataset: Record<TimeframeOption, Record<CampusOption, ChartPoint[]>> = {
  "2024": {
    North: [
      { label: "Jan", attendance: 812, volunteers: 148, firstTimeGuests: 28, salvations: 7 },
      { label: "Feb", attendance: 840, volunteers: 152, firstTimeGuests: 31, salvations: 8 },
      { label: "Mar", attendance: 876, volunteers: 158, firstTimeGuests: 29, salvations: 9 },
      { label: "Apr", attendance: 892, volunteers: 162, firstTimeGuests: 30, salvations: 10 },
      { label: "May", attendance: 924, volunteers: 166, firstTimeGuests: 33, salvations: 11 },
      { label: "Jun", attendance: 948, volunteers: 169, firstTimeGuests: 34, salvations: 11 },
      { label: "Jul", attendance: 936, volunteers: 164, firstTimeGuests: 31, salvations: 10 },
      { label: "Aug", attendance: 957, volunteers: 168, firstTimeGuests: 35, salvations: 12 },
      { label: "Sep", attendance: 994, volunteers: 171, firstTimeGuests: 37, salvations: 13 },
      { label: "Oct", attendance: 1012, volunteers: 176, firstTimeGuests: 40, salvations: 14 },
      { label: "Nov", attendance: 1038, volunteers: 182, firstTimeGuests: 42, salvations: 15 },
      { label: "Dec", attendance: 1075, volunteers: 188, firstTimeGuests: 45, salvations: 16 },
    ],
    South: [
      { label: "Jan", attendance: 764, volunteers: 132, firstTimeGuests: 24, salvations: 6 },
      { label: "Feb", attendance: 772, volunteers: 135, firstTimeGuests: 25, salvations: 6 },
      { label: "Mar", attendance: 801, volunteers: 141, firstTimeGuests: 26, salvations: 7 },
      { label: "Apr", attendance: 823, volunteers: 143, firstTimeGuests: 28, salvations: 8 },
      { label: "May", attendance: 847, volunteers: 147, firstTimeGuests: 30, salvations: 9 },
      { label: "Jun", attendance: 862, volunteers: 149, firstTimeGuests: 31, salvations: 9 },
      { label: "Jul", attendance: 858, volunteers: 145, firstTimeGuests: 29, salvations: 8 },
      { label: "Aug", attendance: 871, volunteers: 148, firstTimeGuests: 32, salvations: 9 },
      { label: "Sep", attendance: 894, volunteers: 151, firstTimeGuests: 33, salvations: 10 },
      { label: "Oct", attendance: 918, volunteers: 155, firstTimeGuests: 34, salvations: 10 },
      { label: "Nov", attendance: 931, volunteers: 157, firstTimeGuests: 36, salvations: 11 },
      { label: "Dec", attendance: 956, volunteers: 163, firstTimeGuests: 38, salvations: 12 },
    ],
    Central: [
      { label: "Jan", attendance: 688, volunteers: 124, firstTimeGuests: 18, salvations: 4 },
      { label: "Feb", attendance: 701, volunteers: 126, firstTimeGuests: 19, salvations: 5 },
      { label: "Mar", attendance: 714, volunteers: 128, firstTimeGuests: 20, salvations: 5 },
      { label: "Apr", attendance: 729, volunteers: 131, firstTimeGuests: 22, salvations: 6 },
      { label: "May", attendance: 742, volunteers: 133, firstTimeGuests: 22, salvations: 6 },
      { label: "Jun", attendance: 758, volunteers: 136, firstTimeGuests: 23, salvations: 7 },
      { label: "Jul", attendance: 752, volunteers: 135, firstTimeGuests: 22, salvations: 6 },
      { label: "Aug", attendance: 768, volunteers: 139, firstTimeGuests: 24, salvations: 7 },
      { label: "Sep", attendance: 784, volunteers: 143, firstTimeGuests: 25, salvations: 8 },
      { label: "Oct", attendance: 801, volunteers: 146, firstTimeGuests: 26, salvations: 8 },
      { label: "Nov", attendance: 814, volunteers: 148, firstTimeGuests: 27, salvations: 9 },
      { label: "Dec", attendance: 839, volunteers: 152, firstTimeGuests: 29, salvations: 10 },
    ],
  },
  "2025": {
    North: [
      { label: "Jan", attendance: 972, volunteers: 171, firstTimeGuests: 34, salvations: 10 },
      { label: "Feb", attendance: 1004, volunteers: 176, firstTimeGuests: 35, salvations: 11 },
      { label: "Mar", attendance: 1036, volunteers: 184, firstTimeGuests: 38, salvations: 12 },
      { label: "Apr", attendance: 1052, volunteers: 188, firstTimeGuests: 39, salvations: 13 },
      { label: "May", attendance: 1094, volunteers: 196, firstTimeGuests: 42, salvations: 14 },
      { label: "Jun", attendance: 1116, volunteers: 199, firstTimeGuests: 43, salvations: 15 },
      { label: "Jul", attendance: 1098, volunteers: 194, firstTimeGuests: 40, salvations: 13 },
      { label: "Aug", attendance: 1132, volunteers: 199, firstTimeGuests: 44, salvations: 15 },
      { label: "Sep", attendance: 1164, volunteers: 205, firstTimeGuests: 45, salvations: 16 },
      { label: "Oct", attendance: 1188, volunteers: 209, firstTimeGuests: 46, salvations: 17 },
      { label: "Nov", attendance: 1216, volunteers: 213, firstTimeGuests: 49, salvations: 18 },
      { label: "Dec", attendance: 1248, volunteers: 218, firstTimeGuests: 50, salvations: 18 },
    ],
    South: [
      { label: "Jan", attendance: 842, volunteers: 149, firstTimeGuests: 28, salvations: 8 },
      { label: "Feb", attendance: 864, volunteers: 151, firstTimeGuests: 29, salvations: 8 },
      { label: "Mar", attendance: 892, volunteers: 157, firstTimeGuests: 31, salvations: 9 },
      { label: "Apr", attendance: 904, volunteers: 159, firstTimeGuests: 32, salvations: 10 },
      { label: "May", attendance: 938, volunteers: 164, firstTimeGuests: 34, salvations: 11 },
      { label: "Jun", attendance: 954, volunteers: 167, firstTimeGuests: 35, salvations: 11 },
      { label: "Jul", attendance: 948, volunteers: 165, firstTimeGuests: 33, salvations: 10 },
      { label: "Aug", attendance: 969, volunteers: 168, firstTimeGuests: 36, salvations: 11 },
      { label: "Sep", attendance: 992, volunteers: 171, firstTimeGuests: 37, salvations: 12 },
      { label: "Oct", attendance: 1018, volunteers: 175, firstTimeGuests: 38, salvations: 13 },
      { label: "Nov", attendance: 1036, volunteers: 179, firstTimeGuests: 40, salvations: 13 },
      { label: "Dec", attendance: 1062, volunteers: 183, firstTimeGuests: 41, salvations: 14 },
    ],
    Central: [
      { label: "Jan", attendance: 732, volunteers: 132, firstTimeGuests: 22, salvations: 6 },
      { label: "Feb", attendance: 748, volunteers: 134, firstTimeGuests: 23, salvations: 6 },
      { label: "Mar", attendance: 761, volunteers: 137, firstTimeGuests: 24, salvations: 7 },
      { label: "Apr", attendance: 778, volunteers: 139, firstTimeGuests: 25, salvations: 7 },
      { label: "May", attendance: 794, volunteers: 143, firstTimeGuests: 26, salvations: 8 },
      { label: "Jun", attendance: 808, volunteers: 145, firstTimeGuests: 27, salvations: 8 },
      { label: "Jul", attendance: 802, volunteers: 143, firstTimeGuests: 26, salvations: 7 },
      { label: "Aug", attendance: 824, volunteers: 147, firstTimeGuests: 28, salvations: 8 },
      { label: "Sep", attendance: 838, volunteers: 149, firstTimeGuests: 29, salvations: 8 },
      { label: "Oct", attendance: 856, volunteers: 152, firstTimeGuests: 30, salvations: 9 },
      { label: "Nov", attendance: 872, volunteers: 154, firstTimeGuests: 31, salvations: 9 },
      { label: "Dec", attendance: 894, volunteers: 159, firstTimeGuests: 32, salvations: 10 },
    ],
  },
  "2026": {
    North: [
      { label: "Jan", attendance: 1054, volunteers: 186, firstTimeGuests: 37, salvations: 11 },
      { label: "Feb", attendance: 1092, volunteers: 191, firstTimeGuests: 39, salvations: 12 },
      { label: "Mar", attendance: 1148, volunteers: 201, firstTimeGuests: 41, salvations: 14 },
      { label: "Apr", attendance: 1176, volunteers: 204, firstTimeGuests: 42, salvations: 14 },
      { label: "May", attendance: 1218, volunteers: 209, firstTimeGuests: 45, salvations: 15 },
      { label: "Jun", attendance: 1242, volunteers: 213, firstTimeGuests: 46, salvations: 16 },
      { label: "Jul", attendance: 1229, volunteers: 210, firstTimeGuests: 44, salvations: 15 },
      { label: "Aug", attendance: 1264, volunteers: 214, firstTimeGuests: 47, salvations: 17 },
      { label: "Sep", attendance: 1292, volunteers: 219, firstTimeGuests: 48, salvations: 18 },
      { label: "Oct", attendance: 1314, volunteers: 223, firstTimeGuests: 50, salvations: 18 },
      { label: "Nov", attendance: 1348, volunteers: 228, firstTimeGuests: 52, salvations: 19 },
      { label: "Dec", attendance: 1386, volunteers: 234, firstTimeGuests: 54, salvations: 20 },
    ],
    South: [
      { label: "Jan", attendance: 902, volunteers: 157, firstTimeGuests: 31, salvations: 9 },
      { label: "Feb", attendance: 928, volunteers: 160, firstTimeGuests: 32, salvations: 10 },
      { label: "Mar", attendance: 964, volunteers: 166, firstTimeGuests: 34, salvations: 11 },
      { label: "Apr", attendance: 986, volunteers: 170, firstTimeGuests: 36, salvations: 11 },
      { label: "May", attendance: 1028, volunteers: 174, firstTimeGuests: 38, salvations: 12 },
      { label: "Jun", attendance: 1042, volunteers: 177, firstTimeGuests: 39, salvations: 13 },
      { label: "Jul", attendance: 1034, volunteers: 175, firstTimeGuests: 37, salvations: 12 },
      { label: "Aug", attendance: 1068, volunteers: 179, firstTimeGuests: 40, salvations: 13 },
      { label: "Sep", attendance: 1096, volunteers: 184, firstTimeGuests: 42, salvations: 14 },
      { label: "Oct", attendance: 1114, volunteers: 186, firstTimeGuests: 43, salvations: 14 },
      { label: "Nov", attendance: 1142, volunteers: 191, firstTimeGuests: 44, salvations: 15 },
      { label: "Dec", attendance: 1178, volunteers: 196, firstTimeGuests: 46, salvations: 16 },
    ],
    Central: [
      { label: "Jan", attendance: 776, volunteers: 139, firstTimeGuests: 24, salvations: 7 },
      { label: "Feb", attendance: 792, volunteers: 142, firstTimeGuests: 25, salvations: 7 },
      { label: "Mar", attendance: 808, volunteers: 145, firstTimeGuests: 27, salvations: 8 },
      { label: "Apr", attendance: 824, volunteers: 148, firstTimeGuests: 28, salvations: 8 },
      { label: "May", attendance: 842, volunteers: 151, firstTimeGuests: 29, salvations: 9 },
      { label: "Jun", attendance: 858, volunteers: 154, firstTimeGuests: 30, salvations: 9 },
      { label: "Jul", attendance: 854, volunteers: 153, firstTimeGuests: 28, salvations: 8 },
      { label: "Aug", attendance: 876, volunteers: 156, firstTimeGuests: 31, salvations: 9 },
      { label: "Sep", attendance: 892, volunteers: 159, firstTimeGuests: 31, salvations: 9 },
      { label: "Oct", attendance: 911, volunteers: 162, firstTimeGuests: 33, salvations: 10 },
      { label: "Nov", attendance: 932, volunteers: 165, firstTimeGuests: 34, salvations: 10 },
      { label: "Dec", attendance: 956, volunteers: 169, firstTimeGuests: 36, salvations: 11 },
    ],
  },
};

export const campusSnapshots: CampusSnapshot[] = [
  {
    campus: "North",
    attendance: 1386,
    volunteers: 234,
    firstTimeGuests: 54,
    salvations: 20,
    status: "Growing",
  },
  {
    campus: "South",
    attendance: 1178,
    volunteers: 196,
    firstTimeGuests: 46,
    salvations: 16,
    status: "Stable",
  },
  {
    campus: "Central",
    attendance: 956,
    volunteers: 169,
    firstTimeGuests: 36,
    salvations: 11,
    status: "Needs follow-up",
  },
];

export const exportHistory: ExportRecord[] = [
  {
    title: "North vs South attendance brief",
    format: "Brief",
    timeframe: "2026",
    campuses: "North / South",
    createdAt: "2 min ago",
    status: "Ready",
  },
  {
    title: "Volunteer comparison export",
    format: "CSV",
    timeframe: "2025",
    campuses: "South / Central",
    createdAt: "14 min ago",
    status: "Ready",
  },
  {
    title: "First-time guest board packet",
    format: "Brief",
    timeframe: "2026",
    campuses: "North / Central",
    createdAt: "Queued",
    status: "Queued",
  },
];

export const aiAnalysis = [
  "North campus is carrying the highest growth curve in 2026, with attendance up steadily after a mild midsummer dip.",
  "South remains the most stable location operationally, with volunteers climbing in step with attendance instead of lagging behind it.",
  "First-time guest growth is healthy overall, but Central is converting awareness more slowly than the other campuses and may need sharper guest follow-up.",
  "Salvations are tracking upward across every campus, suggesting message resonance is improving even where attendance is growing more gradually.",
];

export function getMetricLabel(metric: KpiKey) {
  return metricOptions.find((option) => option.key === metric)?.label ?? metric;
}

// Legacy getComparisonDataset removed — use getComparisonDatasetFromMetrics in sunday-metrics.ts
