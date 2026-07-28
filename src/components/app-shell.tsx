import { Bell, MessageSquareMore } from "lucide-react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./sidebar";

export function AppShell() {
  return (
    <div className="min-h-screen bg-[#edf1f5] p-4 text-slate-900 lg:p-6">
      <Sidebar />

      <div className="lg:pl-[304px]">
        <div className="min-h-[calc(100vh-32px)] overflow-hidden rounded-[32px] border border-gray-200 bg-white lg:min-h-[calc(100vh-48px)]">
          <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 px-5 py-4 backdrop-blur supports-[backdrop-filter]:bg-white/90 sm:px-7 lg:px-10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-[28px]">
                  Welcome back, Jordan
                </h1>
                <p className="mt-1 text-sm text-gray-500">Here is how your campuses are trending today.</p>
              </div>

              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <button className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 bg-white text-slate-700 transition hover:bg-gray-50">
                  <MessageSquareMore className="h-4 w-4" />
                </button>
                <button className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 bg-white text-slate-700 transition hover:bg-gray-50">
                  <Bell className="h-4 w-4" />
                  <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-accent" />
                </button>
                <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-3 py-2">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
                    JD
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-sm font-semibold text-slate-950">Jordan Davis</p>
                    <p className="text-sm text-gray-500">jordan@unionchurch.org</p>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <main className="bg-[#fcfcfd] px-5 py-6 sm:px-7 lg:px-10 lg:py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
