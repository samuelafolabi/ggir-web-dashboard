import {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import type { QueryResult } from "@/lib/duckdb";
import {
  filterByDays,
  filterByDayType,
  filterByParticipant,
  getAllDates,
  getAllParticipants,
  type DayType,
  type AccelUnit,
} from "@/lib/ggir";
import { parseBehavioralCodes, resetClassMapping } from "@/lib/epochs";

type DataContextValue = {
  /* Raw data from parquet */
  data: QueryResult | null;
  setData: (data: QueryResult | null) => void;

  /* Participant state */
  allParticipants: string[];
  selectedParticipant: string | null;
  setSelectedParticipant: (id: string | null) => void;

  /* Filter state */
  selectedDays: Set<string>;
  setSelectedDays: (days: Set<string>) => void;
  toggleDay: (day: string) => void;
  dayType: DayType;
  setDayType: (dt: DayType) => void;
  accelUnit: AccelUnit;
  setAccelUnit: (u: AccelUnit) => void;

  /* Derived */
  allDates: string[];
  filteredRows: Record<string, unknown>[];
};

const DataContext = createContext<DataContextValue | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setDataRaw] = useState<QueryResult | null>(null);
  const [selectedParticipant, setSelectedParticipant] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());
  const [dayType, setDayType] = useState<DayType>("all");
  const [accelUnit, setAccelUnit] = useState<AccelUnit>("mg");

  // All participants in the full dataset
  const allParticipants = useMemo(
    () => (data ? getAllParticipants(data.rows, data.columns) : []),
    [data]
  );

  // When new data is loaded, reset filters and apply metadata-driven class mapping
  const setData = useCallback((d: QueryResult | null) => {
    setDataRaw(d);
    if (d) {
      resetClassMapping();
      parseBehavioralCodes(d.metadata.keyValueMetadata);

      const participants = getAllParticipants(d.rows, d.columns);
      setSelectedParticipant(participants.length > 1 ? participants[0] : null);

      const cols = d.columns;
      const rows = participants.length > 1
        ? filterByParticipant(d.rows, participants[0], cols)
        : d.rows;
      setSelectedDays(new Set(getAllDates(rows)));
    } else {
      resetClassMapping();
      setSelectedParticipant(null);
      setSelectedDays(new Set());
    }
    setDayType("all");
    setAccelUnit("mg");
  }, []);

  // When participant changes, update available dates
  const handleSetParticipant = useCallback(
    (id: string | null) => {
      setSelectedParticipant(id);
      if (data) {
        const rows = filterByParticipant(data.rows, id, data.columns);
        setSelectedDays(new Set(getAllDates(rows)));
      }
    },
    [data]
  );

  const toggleDay = useCallback((day: string) => {
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }, []);

  // Dates for the currently selected participant
  const allDates = useMemo(() => {
    if (!data) return [];
    const rows = filterByParticipant(data.rows, selectedParticipant, data.columns);
    return getAllDates(rows);
  }, [data, selectedParticipant]);

  const filteredRows = useMemo(() => {
    if (!data) return [];
    let rows = filterByParticipant(data.rows, selectedParticipant, data.columns);
    rows = filterByDays(rows, selectedDays);
    rows = filterByDayType(rows, dayType);
    return rows;
  }, [data, selectedParticipant, selectedDays, dayType]);

  return (
    <DataContext.Provider
      value={{
        data,
        setData,
        allParticipants,
        selectedParticipant,
        setSelectedParticipant: handleSetParticipant,
        selectedDays,
        setSelectedDays,
        toggleDay,
        dayType,
        setDayType,
        accelUnit,
        setAccelUnit,
        allDates,
        filteredRows,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) {
    throw new Error("useData must be used within a DataProvider");
  }
  return ctx;
}
