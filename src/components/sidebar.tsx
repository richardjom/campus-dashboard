import {
  ClipboardPlus,
  Cog,
  Database,
  FileText,
  LayoutDashboard,
  MoveRight,
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
    <aside className="hidden lg:fixed lg:bottom-6 lg:left-6 lg:top-6 lg:flex lg:w-72 lg:flex-col lg:overflow-hidden lg:rounded-[32px] lg:border lg:border-gray-200 lg:bg-white">
      <div className="border-b border-gray-200 px-6 py-7">
        <img src="/union-logo.png" alt="Union Church" className="h-10 w-auto object-contain object-left" />
        <p className="mt-3 text-sm text-gray-500">Leadership analytics</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 scrollbar-hidden">
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
                        "flex items-center justify-between rounded-2xl px-3 py-3 text-sm font-medium transition",
                        isActive
                          ? "bg-[#2563eb] text-white"
                          : "text-slate-700 hover:bg-gray-50 hover:text-slate-950",
                      ].join(" ")
                    }
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </span>
                  </NavLink>
                );
              })}
            </nav>
          </section>
        ))}

        <div className="rounded-[28px] border border-gray-200 bg-[#f8fafc] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Report center</p>
          <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950">Export-ready</p>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            Any campus comparison you build on the dashboard can now be exported as a board brief or raw CSV.
          </p>
          <NavLink
            to="/insights"
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-gray-50"
          >
            Open reports
            <MoveRight className="h-4 w-4" />
          </NavLink>
        </div>
      </div>

      <div className="border-t border-gray-200 p-4">
        <div className="rounded-[24px] border border-gray-200 bg-[#fbfbfc] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Signed in</p>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-100 text-sm font-semibold text-teal-700">
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
