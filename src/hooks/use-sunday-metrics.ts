import { useEffect, useState } from "react";
import { METRICS_UPDATED_EVENT, resolveSundayMetricsDataset, type SundayMetric, type SundayMetricsSource } from "../lib/sunday-metrics";

export function useSundayMetrics() {
  const [dataset, setDataset] = useState<{
    metrics: SundayMetric[];
    source: SundayMetricsSource;
  }>(() => resolveSundayMetricsDataset());

  useEffect(() => {
    const refresh = () => {
      setDataset(resolveSundayMetricsDataset());
    };

    window.addEventListener("storage", refresh);
    window.addEventListener(METRICS_UPDATED_EVENT, refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(METRICS_UPDATED_EVENT, refresh);
    };
  }, []);

  return dataset;
}
