import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Line, LineChart, ResponsiveContainer } from "recharts";
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

  return (
    <article className="rounded-[26px] border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-500">{card.label}</p>
          <p className="mt-4 text-[44px] font-semibold leading-none tracking-[-0.06em] text-slate-950">
            {card.value}
          </p>
        </div>

        <span
          className={[
            "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold",
            isPositive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700",
          ].join(" ")}
        >
          {isPositive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
          {card.change}
        </span>
      </div>

      <div className="mt-5 h-16 rounded-2xl bg-[#fbfbfc] px-1 py-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sparklineData}>
            <Line
              type="monotone"
              dataKey="value"
              stroke={isPositive ? "#0f766e" : "#dc2626"}
              strokeWidth={2.25}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-4 text-sm text-gray-500">{card.footnote}</p>
    </article>
  );
}
