import { useEffect, useState } from "react";
import { BIG_EVENTS_UPDATED_EVENT, readImportedBigEvents, type BigEventRecord } from "../lib/big-events";

export function useBigEvents() {
  const [records, setRecords] = useState<BigEventRecord[]>(() => readImportedBigEvents());

  useEffect(() => {
    const refresh = () => {
      setRecords(readImportedBigEvents());
    };

    window.addEventListener("storage", refresh);
    window.addEventListener(BIG_EVENTS_UPDATED_EVENT, refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(BIG_EVENTS_UPDATED_EVENT, refresh);
    };
  }, []);

  return {
    records,
    hasData: records.length > 0,
  };
}
