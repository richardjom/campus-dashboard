import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import type { KpiCard as KpiCardType } from "../lib/mock-data";

type KpiCardProps = {
  card: KpiCardType;
};

export function KpiCard({ card }: KpiCardProps) {
  const sparklineData = card.sparkline.map((value, index) => ({
    index,
    value,
  }));

  const isPositive = card.changeDirection === "up";
  const gradientId = `kpi-gradient-${card.key}`;

  return (
    <article className="rounded-[26px] border border-gray-200 bg-white p-5 transition hover:border-gray-300">
      <p className="text-sm font-medium text-gray-500">{card.label}</p>

      <div className="mt-3 flex items-baseline gap-2">
        <p className="text-[36px] font-semibold leading-none tracking-[-0.05em] text-slate-950">{card.value}</p>
        <span
          className={[
            "inline-flex items-center gap-0.5 text-xs font-semibold",
            isPositive ? "text-emerald-600" : "text-rose-600",
          ].join(" ")}
        >
          {card.change}
          {isPositive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
        </span>
      </div>

      <div className="mt-4 h-16">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sparklineData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ea580c" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#ea580c" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke="#ea580c"
              strokeWidth={2.25}
              fill={`url(#${gradientId})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-3 text-sm text-gray-500">{card.footnote}</p>
    </article>
  );
}
