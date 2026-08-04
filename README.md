# Campus Dashboard

Church analytics and reporting dashboard built for multi-campus weekend performance review, Sunday data entry, people tracking, and executive reporting.

## Overview

This project is a React + Vite application for church operations teams who need to:

- compare campuses across multiple years and time periods
- enter Sunday metrics manually or via CSV
- upload historical attendance and ministry datasets
- generate executive-style reports and comparisons
- import people from Planning Center using a Personal Access Token

The UI is organized around clean SaaS-style reporting screens with a fixed app shell, campus comparison tools, export workflows, and local browser persistence for imported data.

## Main Routes

- `/dashboard` — performance dashboard, campus comparison, KPI cards, and exported report views
- `/entry` — Sunday entry workflow for manual entry and CSV-based updates
- `/people` — people directory and categorization workspace
- `/pipeline` — journey / follow-up pipeline view
- `/records` — historical data upload and dataset management
- `/insights` — report-oriented analysis view
- `/settings` — Planning Center connection and people import

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Recharts
- Lucide React

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Start the app

```bash
npm run dev
```

Vite will print the local URL in the terminal. During recent local development this app has often been opened on `http://127.0.0.1:4173`, but the default Vite port may vary.

### 3. Production build

```bash
npm run build
```

### 4. Preview the production build

```bash
npm run preview
```

## Data Import Support

The dashboard supports several import formats:

- Flat `sunday_metrics` CSV files
- Multi-file campus dashboard bundles
- Legacy weekend experience summary exports
- Big 5 event history CSV files

The import workflow lives in `/records`. Imported data is stored in browser `localStorage`, so imported numbers are browser-specific until you upload the same dataset in another browser.

## Planning Center Import

The Settings page supports Planning Center people import using a Personal Access Token client ID and secret.

- The frontend posts to `/api/planning-center/test` and `/api/planning-center/people`
- Those endpoints now exist both in local development and in deployed hosting
- Local development still uses the Vite middleware bridge, with no separate proxy process required
- Production hosting uses deployed API routes so the public site can reach Planning Center too

Files involved:

- [`api/planning-center/test.ts`](./api/planning-center/test.ts)
- [`api/planning-center/people.ts`](./api/planning-center/people.ts)
- [`server/planning-center-http.ts`](./server/planning-center-http.ts)
- [`vite.config.ts`](./vite.config.ts)
- [`server/planning-center-proxy.ts`](./server/planning-center-proxy.ts)
- [`src/lib/planning-center.ts`](./src/lib/planning-center.ts)

## Project Structure

```text
src/
  components/   Shared dashboard and layout components
  data/         Preloaded bundled metric data
  hooks/        Client hooks for Sunday metrics and Big 5 events
  lib/          Import, reporting, people, and analytics logic
  pages/        Route-level screens
  router.tsx    App routes

server/
  planning-center-proxy.ts

scripts/
  merge-2025-bundle.mjs
```

## Notes

- Historical metric repairs and import normalization are handled in `src/lib/sunday-metrics.ts`
- Big 5 event history is stored separately from standard Sunday metrics
- Imported people, imported metrics, and pipeline data are persisted locally in the browser

## Repository

GitHub: [richardjom/campus-dashboard](https://github.com/richardjom/campus-dashboard)
