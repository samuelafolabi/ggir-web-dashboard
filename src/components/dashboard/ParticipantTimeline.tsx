import { useMemo } from "react";
import PlotlyChart from "@/components/PlotlyChart";
import { useData } from "@/context/DataContext";
import {
  GGIR_COLUMNS,
  hasColumn,
  toNumber,
  toString,
  formatDate,
  getAllParticipants,
  filterByParticipant,
  getAllDates,
} from "@/lib/ggir";

type Row = Record<string, unknown>;

/**
 * Participant Timeline — shows a Gantt-style chart with one row per participant,
 * bars spanning their recording days, with optional colour-coding by valid hours.
 * For single-participant files, shows a day-level timeline with key metrics.
 */
export function ParticipantTimeline() {
  const { data, filteredRows } = useData();
  const columns = data?.columns ?? [];
  const rows = filteredRows;

  const participants = useMemo(
    () => getAllParticipants(rows, columns),
    [rows, columns]
  );

  const isMulti = participants.length > 1;

  const transparentLayout = {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { color: "hsl(var(--foreground))" },
  };

  const nonwearCol = hasColumn(columns, GGIR_COLUMNS.nonwearPercDaySpt)
    ? GGIR_COLUMNS.nonwearPercDaySpt
    : hasColumn(columns, GGIR_COLUMNS.nonwearPercDay)
    ? GGIR_COLUMNS.nonwearPercDay
    : null;

  // ── Multi-participant: Gantt-style overview ───────────────────────
  const multiData = useMemo(() => {
    if (!isMulti) return null;

    const items: {
      participant: string;
      dates: string[];
      formattedDates: string[];
      nDays: number;
      avgValidHours: number | null;
    }[] = [];

    for (const pid of participants) {
      const pRows = filterByParticipant(rows, pid, columns);
      const rawDates = getAllDates(pRows);
      const formattedDates = rawDates.map((d) => formatDate(d));

      let avgValidHours: number | null = null;
      if (nonwearCol) {
        const vals = pRows
          .map((r) => toNumber(r[nonwearCol]))
          .filter((v): v is number => v !== null);
        if (vals.length > 0) {
          const avgNonwear = vals.reduce((a, b) => a + b, 0) / vals.length;
          avgValidHours = 24 * (1 - avgNonwear / 100);
        }
      }

      items.push({
        participant: pid,
        dates: rawDates,
        formattedDates,
        nDays: rawDates.length,
        avgValidHours,
      });
    }

    return items;
  }, [isMulti, participants, rows, columns]);

  // ── Single-participant: day-level timeline ────────────────────────
  const singleData = useMemo(() => {
    if (isMulti || rows.length === 0) return null;

    const dayEntries: {
      label: string;
      wearHours: number | null;
      nonwearPerc: number | null;
      accDayMg: number | null;
    }[] = [];

    for (const r of rows) {
      const rawDate = toString(r[GGIR_COLUMNS.calendarDate]);
      const weekday = toString(r[GGIR_COLUMNS.weekday]);
      const formatted = formatDate(rawDate) || rawDate;
      const label = weekday ? `${weekday} (${formatted})` : formatted;
      const nw = nonwearCol ? toNumber(r[nonwearCol]) : null;

      dayEntries.push({
        label: label || `Day ${dayEntries.length + 1}`,
        wearHours: nw != null ? 24 * (1 - nw / 100) : null,
        nonwearPerc: nw,
        accDayMg: toNumber(r[GGIR_COLUMNS.accDayMg]),
      });
    }

    return dayEntries;
  }, [isMulti, rows, columns]);

  if (!data) return null;

  // ── Multi-participant rendering ────────────────────────────────────
  if (isMulti && multiData) {
    return (
      <section className="space-y-3">
        <h3 className="text-base font-semibold">Participant Timeline Overview</h3>
        <div className="rounded-lg border bg-card p-4">
          <div style={{ height: Math.max(200, participants.length * 40 + 100) }}>
            <PlotlyChart
              data={multiData.map((p, i) => ({
                x: [p.nDays],
                y: [p.participant],
                type: "bar" as const,
                orientation: "h" as const,
                marker: {
                  color:
                    p.avgValidHours !== null
                      ? p.avgValidHours >= 16
                        ? "#22c55e"
                        : p.avgValidHours >= 10
                          ? "#eab308"
                          : "#ef4444"
                      : "hsl(var(--chart-1))",
                },
                name: p.participant,
                showlegend: false,
                hovertext: `${p.participant}\n${p.nDays} days: ${p.formattedDates[0] || "?"} — ${p.formattedDates[p.formattedDates.length - 1] || "?"}\nAvg valid hrs: ${p.avgValidHours?.toFixed(1) ?? "N/A"}`,
                hoverinfo: "text" as const,
              }))}
              layout={{
                ...transparentLayout,
                xaxis: { title: { text: "Recording Days" } },
                yaxis: { autorange: "reversed" as const },
                margin: { t: 20, b: 50, l: 200, r: 20 },
                barmode: "stack",
              }}
            />
          </div>
        </div>
      </section>
    );
  }

  // ── Single-participant rendering ───────────────────────────────────
  if (singleData && singleData.length > 0) {
    const labels = singleData.map((d) => d.label);
    const hasWear = singleData.some((d) => d.wearHours !== null);
    const hasNonwear = singleData.some((d) => d.nonwearPerc !== null);
    const hasAccel = singleData.some((d) => d.accDayMg !== null);

    const traces = [];

    if (hasWear) {
      traces.push({
        x: labels,
        y: singleData.map((d) => d.wearHours),
        type: "bar" as const,
        name: "Wear Hours",
        marker: { color: "hsl(var(--chart-2))" },
        yaxis: "y" as const,
      });
    }

    if (hasNonwear) {
      traces.push({
        x: labels,
        y: singleData.map((d) => d.nonwearPerc),
        type: "scatter" as const,
        mode: "lines+markers" as const,
        name: "Non-Wear %",
        marker: { color: "hsl(var(--chart-5))" },
        yaxis: "y2" as const,
      });
    }

    if (hasAccel && !hasWear && !hasNonwear) {
      traces.push({
        x: labels,
        y: singleData.map((d) => d.accDayMg),
        type: "bar" as const,
        name: "Acceleration (mg)",
        marker: { color: "hsl(var(--chart-1))" },
      });
    }

    return (
      <section className="space-y-3">
        <h3 className="text-base font-semibold">Recording Timeline</h3>
        <div className="rounded-lg border bg-card p-4">
          <div className="h-[300px]">
            <PlotlyChart
              data={traces}
              layout={{
                ...transparentLayout,
                xaxis: { title: { text: "Day" } },
                yaxis: {
                  title: { text: hasWear ? "Wear Hours" : "Value" },
                  side: "left" as const,
                  ...(hasWear ? { range: [0, 24], tickvals: [0, 6, 12, 18, 24] } : {}),
                },
                ...(hasNonwear && hasWear
                  ? {
                      yaxis2: {
                        title: { text: "Non-Wear %" },
                        overlaying: "y" as const,
                        side: "right" as const,
                        range: [0, 100],
                        tickvals: [0, 25, 50, 75, 100],
                        showgrid: false,
                      },
                    }
                  : {}),
                margin: { t: 20, b: 80, l: 60, r: hasNonwear && hasWear ? 60 : 20 },
                showlegend: true,
                legend: { orientation: "h" as const, y: 1.12 },
              }}
            />
          </div>
        </div>
      </section>
    );
  }

  return null;
}
