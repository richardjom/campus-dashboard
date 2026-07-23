import { Bell, MessageSquareMore, Search } from "lucide-react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./sidebar";

export function AppShell() {
  return (
    <div className="min-h-screen bg-[#edf1f5] p-4 text-slate-900 lg:p-6">
      <Sidebar />

      <div className="lg:pl-[304px]">
        <div className="min-h-[calc(100vh-32px)] overflow-hidden rounded-[32px] border border-gray-200 bg-white lg:min-h-[calc(100vh-48px)]">
          <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 px-5 py-4 backdrop-blur supports-[backdrop-filter]:bg-white/90 sm:px-7 lg:px-10">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <label className="flex h-14 w-full max-w-[640px] items-center gap-3 rounded-2xl border border-gray-200 bg-[#fbfbfc] px-5 text-sm text-gray-500">
                <Search className="h-4 w-4 text-gray-400" />
                <input
                  className="w-full border-none bg-transparent text-sm text-slate-900 outline-none placeholder:text-gray-400"
                  placeholder="Search reports, campuses, guests, or notes..."
                />
                <span className="hidden rounded-xl border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-500 md:inline-flex">
                  Cmd + F
                </span>
              </label>

              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <button className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 bg-white text-slate-700 transition hover:bg-gray-50">
                  <Bell className="h-4 w-4" />
                </button>
                <button className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 bg-white text-slate-700 transition hover:bg-gray-50">
                  <MessageSquareMore className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-3 py-2">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-100 text-sm font-semibold text-teal-700">
                    JD
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-sm font-semibold text-slate-950">Jordan Davis</p>
                    <p className="text-sm text-gray-500">Executive Pastor</p>
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
