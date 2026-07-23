import { Navigate, RouterProvider, createBrowserRouter } from "react-router-dom";
import { AppShell } from "./components/app-shell";
import { DashboardPage } from "./pages/dashboard-page";
import { EntryPage } from "./pages/entry-page";
import { InsightsPage } from "./pages/insights-page";
import { RecordsPage } from "./pages/records-page";
import { SettingsPage } from "./pages/settings-page";
import { PeoplePage } from "./pages/people-page";
import { PipelinePage } from "./pages/pipeline-page";

const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: "dashboard",
        element: <DashboardPage />,
      },
      {
        path: "entry",
        element: <EntryPage />,
      },
      {
        path: "people",
        element: <PeoplePage />,
      },
      {
        path: "pipeline",
        element: <PipelinePage />,
      },
      {
        path: "records",
        element: <RecordsPage />,
      },
      {
        path: "insights",
        element: <InsightsPage />,
      },
      {
        path: "settings",
        element: <SettingsPage />,
      },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
