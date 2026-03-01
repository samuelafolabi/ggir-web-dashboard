import { useMemo } from "react";
import PlotlyChart from "@/components/PlotlyChart";
import { CLASS_COLORS, CLASS_LABELS } from "@/lib/epochs";
import { formatDate } from "@/lib/ggir";
import type { Data, Layout } from "plotly.js";

type DayEpochs = {
  calendar_date: string;
  weekday: string;
  epochs: { timenum: number; class_id: number; spt: boolean; invalid: boolean }[];
};

function epochToHourFraction(timenum: number): number {
  const d = new Date(timenum * 1000);
  return d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
}

type Props = {
  days: DayEpochs[];
  onDayClick?: (calendarDate: string) => void;
};

const NUM_BINS = 288; // 5-minute bins across 24 hours

export function MultiDayStack({ days, onDayClick }: Props) {
  const dayLabels = useMemo(
    () =>
      days.map((d) => {
        const formatted = formatDate(d.calendar_date);
        return d.weekday ? `${d.weekday} (${formatted})` : formatted || d.calendar_date;
      }),
    [days]
  );

  // Collect all unique class_ids to build a discrete colorscale
  const { z, hoverText, colorscale, nClasses } = useMemo(() => {
    const allClassIds = new Set<number>();
    for (const day of days) {
      for (const e of day.epochs) allClassIds.add(e.class_id);
    }
    const sortedIds = Array.from(allClassIds).sort((a, b) => a - b);
    const idToIndex = new Map<number, number>();
    sortedIds.forEach((id, i) => idToIndex.set(id, i));
    const nClasses = sortedIds.length;

    // Build discrete colorscale: map index [0..nClasses-1] → normalized [0..1]
    const cs: [number, string][] = [];
    for (let i = 0; i < nClasses; i++) {
      const lo = i / Math.max(nClasses, 1);
      const hi = (i + 1) / Math.max(nClasses, 1);
      const color = CLASS_COLORS[sortedIds[i]] ?? "#6b7280";
      cs.push([lo, color]);
      cs.push([hi, color]);
    }
    if (cs.length === 0) {
      cs.push([0, "#6b7280"], [1, "#6b7280"]);
    }

    // Build z matrix: rows = days (reversed so first day is at top), cols = time bins
    const zMatrix: number[][] = [];
    const htMatrix: string[][] = [];

    for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
      const row = new Array<number>(NUM_BINS).fill(-1);
      const htRow = new Array<string>(NUM_BINS).fill("");
      const day = days[dayIdx];

      for (const e of day.epochs) {
        const hour = epochToHourFraction(e.timenum);
        const bin = Math.min(Math.floor((hour / 24) * NUM_BINS), NUM_BINS - 1);
        const idx = idToIndex.get(e.class_id) ?? 0;
        row[bin] = idx;
        const label = CLASS_LABELS[e.class_id] ?? `Class ${e.class_id}`;
        const timeStr = `${Math.floor(hour).toString().padStart(2, "0")}:${Math.round((hour % 1) * 60).toString().padStart(2, "0")}`;
        htRow[bin] = `${dayLabels[dayIdx]}<br>${timeStr} — ${label}${e.invalid ? " (invalid)" : ""}`;
      }

      // Fill gaps: any bin still at -1 gets a neutral value
      for (let b = 0; b < NUM_BINS; b++) {
        if (row[b] === -1) {
          row[b] = NaN;
          htRow[b] = `${dayLabels[dayIdx]}<br>No data`;
        }
      }

      zMatrix.push(row);
      htMatrix.push(htRow);
    }

    return { z: zMatrix, hoverText: htMatrix, colorscale: cs, nClasses };
  }, [days, dayLabels]);

  const xLabels = useMemo(
    () => Array.from({ length: NUM_BINS }, (_, i) => (i * 24) / NUM_BINS),
    []
  );

  const trace: Data = {
    z,
    x: xLabels,
    y: dayLabels,
    type: "heatmap",
    colorscale,
    showscale: false,
    hoverinfo: "text" as const,
    text: hoverText as unknown as string[],
    xgap: 0,
    ygap: 2,
    zmin: 0,
    zmax: Math.max(nClasses - 1, 1),
  };

  const layout: Partial<Layout> = {
    xaxis: {
      title: { text: "Time of Day" },
      range: [0, 24],
      dtick: 3,
      tickvals: Array.from({ length: 9 }, (_, i) => i * 3),
      ticktext: Array.from({ length: 9 }, (_, i) => `${(i * 3).toString().padStart(2, "0")}:00`),
    },
    yaxis: {
      autorange: "reversed" as const,
      fixedrange: true,
    },
    margin: { t: 20, r: 20, b: 50, l: 180 },
    height: Math.max(200, days.length * 60 + 80),
    hovermode: "closest",
  };

  if (days.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-muted-foreground text-sm">
        No multi-day data available.
      </div>
    );
  }

  return (
    <div>
      <PlotlyChart
        data={[trace]}
        layout={layout}
        config={{ responsive: true, displayModeBar: false }}
        onClick={(event) => {
          const point = event.points?.[0] as unknown as { pointIndex?: number[] } | undefined;
          const dayIdx = point?.pointIndex?.[0];
          if (onDayClick && typeof dayIdx === "number") {
            if (dayIdx >= 0 && dayIdx < days.length) {
              onDayClick(days[dayIdx].calendar_date);
            }
          }
        }}
      />
      <p className="mt-1 text-xs text-muted-foreground text-center">
        Click on a day to view detailed timeline
      </p>
    </div>
  );
}
