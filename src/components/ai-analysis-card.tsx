import { Sparkles } from "lucide-react";
import { aiAnalysis } from "../lib/mock-data";

export function AiAnalysisCard() {
  return (
    <aside className="rounded-[32px] border border-gray-200 bg-white p-6 lg:p-7">
      <div className="flex items-start justify-between gap-4 border-b border-gray-200 pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">AI Analysis</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
            Leadership synthesis
          </h2>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-stone-50 text-teal-700">
          <Sparkles className="h-4 w-4" />
        </div>
      </div>

      <div className="space-y-5 py-6">
        {aiAnalysis.map((item) => (
          <div key={item} className="rounded-[24px] border border-gray-200 bg-stone-50 p-4">
            <p className="text-sm leading-6 text-slate-700">{item}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-200 pt-6">
        <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
          Generated 2 minutes ago
        </div>
        <p className="mt-4 text-sm leading-6 text-gray-500">
          This block is currently mocked to simulate the future LLM narrative that will summarize Railway-backed
          metrics and trend anomalies for leadership review.
        </p>
      </div>
    </aside>
  );
}
