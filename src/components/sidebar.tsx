import {
  ClipboardPlus,
  Cog,
  Database,
  FileText,
  LayoutDashboard,
  MoveRight,
  Search,
  Sparkles,
  Users,
  GitMerge,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { navigationItems } from "../lib/mock-data";

const iconMap = {
  Dashboard: LayoutDashboard,
  "Sunday Entry": ClipboardPlus,
  "Historical Data": Database,
  Reports: FileText,
  People: Users,
  Pipeline: GitMerge,
  Settings: Cog,
} as const;

export function Sidebar() {
  const groupedItems = navigationItems.reduce<Record<string, typeof navigationItems>>((accumulator, item) => {
    accumulator[item.group] ??= [];
    accumulator[item.group].push(item);
    return accumulator;
  }, {});

  return (
    <aside className="hidden lg:fixed lg:bottom-6 lg:left-6 lg:top-6 lg:flex lg:w-72 lg:flex-col lg:overflow-hidden lg:rounded-[32px] lg:border lg:border-gray-200 lg:bg-[#fafafa]">
      <div className="px-6 pb-4 pt-7">
        <img src="/union-logo.png" alt="Union Church" className="h-10 w-auto object-contain object-left" />
        <p className="mt-3 text-sm text-gray-500">Leadership analytics</p>

        <label className="mt-5 flex h-11 items-center gap-2.5 rounded-2xl border border-gray-200 bg-white px-3.5 text-sm text-gray-500">
          <Search className="h-4 w-4 text-gray-400" />
          <input
            className="w-full border-none bg-transparent text-sm text-slate-900 outline-none placeholder:text-gray-400"
            placeholder="Search"
          />
          <span className="rounded-lg border border-gray-200 bg-[#fafafa] px-1.5 py-0.5 text-xs font-semibold text-gray-400">
            ⌘F
          </span>
        </label>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-hidden">
        {Object.entries(groupedItems).map(([group, items]) => (
          <section key={group} className="mb-7">
            <p className="px-3 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">{group}</p>
            <nav className="mt-3 space-y-1">
              {items.map((item) => {
                const Icon = iconMap[item.label as keyof typeof iconMap];

                return (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    className={({ isActive }) =>
                      [
                        "flex items-center justify-between rounded-2xl px-3 py-2.5 text-sm transition",
                        isActive
                          ? "border border-gray-200 bg-white font-semibold text-slate-950 shadow-sm"
                          : "border border-transparent font-medium text-slate-600 hover:bg-white/70 hover:text-slate-950",
                      ].join(" ")
                    }
                  >
                    {({ isActive }) => (
                      <span className="flex items-center gap-3">
                        <Icon className={["h-4 w-4", isActive ? "text-accent" : "text-slate-400"].join(" ")} />
                        {item.label}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </nav>
          </section>
        ))}

        <div className="rounded-[28px] border border-gray-200 bg-white p-5">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <Sparkles className="h-5 w-5" />
          </span>
          <p className="mt-4 text-base font-semibold tracking-[-0.02em] text-slate-950">Export-ready reports</p>
          <p className="mt-1.5 text-sm leading-6 text-gray-500">
            Turn any campus comparison into a board brief or raw CSV.
          </p>
          <NavLink
            to="/insights"
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Open reports
            <MoveRight className="h-4 w-4" />
          </NavLink>
        </div>
      </div>

      <div className="border-t border-gray-200 p-4">
        <div className="rounded-[24px] border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Signed in</p>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
              JD
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-950">Jordan Davis</p>
              <p className="text-sm text-gray-500">Executive Pastor</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
