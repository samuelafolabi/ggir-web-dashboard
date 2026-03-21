import { useMemo } from "react";
import { AlertCircle } from "lucide-react";
import PlotlyChart from "@/components/PlotlyChart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useData } from "@/context/DataContext";
import {
  GGIR_COLUMNS,
  hasColumn,
  toNumber,
  toString,
  formatDate,
  computeSleepEfficiency,
  computeMeanWASO,
  computeMeanSleepDuration,
  getWASOValues,
  stdDev,
} from "@/lib/ggir";
import { SleepHypnogram } from "@/components/dashboard/SleepHypnogram";

function MissingColumn({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-dashed p-6 text-sm text-muted-foreground">
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span>Column <code className="font-mono text-xs">{name}</code> not found in this file.</span>
    </div>
  );
}

/** Convert a decimal-hour value (e.g. 23.5) to an HH:MM string for display */
function decimalHourToTime(h: number): string {
  // Handle negative or >24 values (next-day wrap)
  const norm = ((h % 24) + 24) % 24;
  const hours = Math.floor(norm);
  const mins = Math.round((norm - hours) * 60);
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/** Convert decimal hour to minutes from noon (for plotting on noon-to-noon axis) */
function decimalHourToMinFromNoon(h: number): number {
  // Shift so noon=0, midnight=720, next-noon=1440
  let shifted = h - 12;
  if (shifted < 0) shifted += 24;
  return shifted * 60;
}

/** Ensure end minute is after start minute on a noon-to-noon axis. */
function normalizeEndAfterStart(startMin: number, endMin: number): number {
  return endMin <= startMin ? endMin + 1440 : endMin;
}

export function SleepAnalysisTab() {
  const { data, filteredRows } = useData();
  const columns = data?.columns ?? [];

  const hasOnset = hasColumn(columns, GGIR_COLUMNS.sleeponset);
  const hasWakeup = hasColumn(columns, GGIR_COLUMNS.wakeup);
  const hasSleepData = hasOnset && hasWakeup;

  const transparentLayout = {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { color: "hsl(var(--foreground))" },
  };

  // ── Raster / Hypnogram data ─────────────────────────────────────────
  const rasterData = useMemo(() => {
    if (!hasSleepData) return null;

    const entries: { date: string; onset: number; wake: number }[] = [];
    for (const r of filteredRows) {
      const rawDate = toString(r[GGIR_COLUMNS.calendarDate]);
      const label = formatDate(rawDate) || rawDate;
      const onset = toNumber(r[GGIR_COLUMNS.sleeponset]);
      const wake = toNumber(r[GGIR_COLUMNS.wakeup]);
      if (onset !== null && wake !== null && label) {
        entries.push({ date: label, onset, wake });
      }
    }

    // Build shapes (horizontal bars from onset to wakeup on a noon-to-noon axis)
    const dates = entries.map((e) => e.date);
    const onsetMins = entries.map((e) => decimalHourToMinFromNoon(e.onset));
    const wakeMins = entries.map((e, i) =>
      normalizeEndAfterStart(onsetMins[i], decimalHourToMinFromNoon(e.wake))
    );

    // WASO overlay (computed from dur_spt_min - dur_spt_sleep_min)
    const wasoMins = getWASOValues(filteredRows, columns);
    const hasWaso = wasoMins.some((v) => v != null);

    return { dates, onsetMins, wakeMins, wasoMins, entries, hasWaso };
  }, [filteredRows, hasSleepData, columns]);

  // ── Sleep regularity data ───────────────────────────────────────────
  const regularityData = useMemo(() => {
    if (!hasSleepData) return null;

    const dates: string[] = [];
    const onsetTimes: (number | null)[] = [];
    const wakeTimes: (number | null)[] = [];

    for (const r of filteredRows) {
      const rawDate = toString(r[GGIR_COLUMNS.calendarDate]);
      const label = formatDate(rawDate) || rawDate;
      const onset = toNumber(r[GGIR_COLUMNS.sleeponset]);
      const wake = toNumber(r[GGIR_COLUMNS.wakeup]);
      if (label) {
        dates.push(label);
        onsetTimes.push(onset);
        wakeTimes.push(wake);
      }
    }

    return { dates, onsetTimes, wakeTimes };
  }, [filteredRows, hasSleepData]);

  // ── Hypnogram input (string times) for the custom component ─────────
  // Prefer an explicit \"night\" column if present; otherwise fall back to row index.
  const hypnogramInput = useMemo(
    () => {
      if (!hasSleepData) return [];

      // Try to find a GGIR \"night\" column (e.g. night, nightno, night_id, etc.)
      const nightCol =
        columns.find((c) => c.toLowerCase().includes("night")) ?? null;

      return filteredRows
        .map((r, i) => {
          const rawDate = toString(r[GGIR_COLUMNS.calendarDate]);
          const dateLabel = formatDate(rawDate) || rawDate;
          const onset = toNumber(r[GGIR_COLUMNS.sleeponset]);
          const wake = toNumber(r[GGIR_COLUMNS.wakeup]);
          if (!dateLabel || onset === null || wake === null) return null;

          // Build a unique night label per row
          let nightLabel: string;
          if (nightCol) {
            const nv = toString((r as Record<string, unknown>)[nightCol]);
            nightLabel = nv || `night ${i + 1}`;
          } else {
            nightLabel = `night ${i + 1}`;
          }

          return {
            // Include both GGIR's night label (if any) and a row index to
            // guarantee uniqueness per night for Plotly's Y-axis categories.
            date: `${dateLabel} (${nightLabel}, row ${i + 1})`,
            sleepOnset: decimalHourToTime(onset),
            wakeUp: decimalHourToTime(wake),
          };
        })
        .filter(
          (d): d is { date: string; sleepOnset: string; wakeUp: string } =>
            d !== null
        );
    },
    [filteredRows, hasSleepData, columns]
  );

  // ── Sleep duration values (per-night) for distribution plots ───────
  const sleepDurations = useMemo(() => {
    if (!columns.includes(GGIR_COLUMNS.durSptSleepMin)) return null;
    const vals = filteredRows
      .map((r) => toNumber(r[GGIR_COLUMNS.durSptSleepMin]))
      .filter((v): v is number => v !== null)
      .map((v) => v / 60); // convert minutes to hours
    return vals.length > 0 ? vals : null;
  }, [filteredRows, columns]);

  // ── Key metrics ─────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const efficiency = computeSleepEfficiency(filteredRows, columns);
    const waso = computeMeanWASO(filteredRows, columns);
    const duration = computeMeanSleepDuration(filteredRows, columns);

    // Compute SDs
    const effVals = columns.includes(GGIR_COLUMNS.sleepEfficiency)
      ? filteredRows.map((r) => toNumber(r[GGIR_COLUMNS.sleepEfficiency])).filter((v): v is number => v !== null)
      : [];
    const wasoVals = getWASOValues(filteredRows, columns).filter((v): v is number => v !== null);
    const durVals = columns.includes(GGIR_COLUMNS.durSptSleepMin)
      ? filteredRows.map((r) => toNumber(r[GGIR_COLUMNS.durSptSleepMin])).filter((v): v is number => v !== null).map((v) => v / 60)
      : [];

    return {
      efficiency,
      efficiencySD: stdDev(effVals),
      waso,
      wasoSD: stdDev(wasoVals),
      duration,
      durationSD: stdDev(durVals),
    };
  }, [filteredRows, columns]);

  // Helper for tick values on noon-to-noon axis
  const noonAxisTicks = {
    tickmode: "array" as const,
    tickvals: [0, 180, 360, 540, 720, 900, 1080, 1260, 1440],
    ticktext: ["12:00", "15:00", "18:00", "21:00", "00:00", "03:00", "06:00", "09:00", "12:00"],
  };

  return (
    <div className="space-y-8">
      {/* Key Metrics Table */}
      <section className="space-y-3">
        <h3 className="text-base font-semibold">Key Sleep Metrics</h3>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Metric</TableHead>
                <TableHead>Mean</TableHead>
                <TableHead>SD</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Sleep Efficiency</TableCell>
                <TableCell>
                  {metrics.efficiency !== null ? `${metrics.efficiency.toFixed(1)}%` : "N/A"}
                </TableCell>
                <TableCell>
                  {metrics.efficiencySD > 0 ? `${metrics.efficiencySD.toFixed(1)}%` : "—"}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">WASO</TableCell>
                <TableCell>
                  {metrics.waso !== null ? `${metrics.waso.toFixed(1)} min` : "N/A"}
                </TableCell>
                <TableCell>
                  {metrics.wasoSD > 0 ? `${metrics.wasoSD.toFixed(1)} min` : "—"}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Sleep Duration</TableCell>
                <TableCell>
                  {metrics.duration !== null ? `${metrics.duration.toFixed(1)} hrs` : "N/A"}
                </TableCell>
                <TableCell>
                  {metrics.durationSD > 0 ? `${metrics.durationSD.toFixed(1)} hrs` : "—"}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Raster / Hypnogram */}
      <section className="space-y-3">
        <h3 className="text-base font-semibold">Sleep Raster Plot</h3>
        {!hasSleepData ? (
          <MissingColumn name={`${GGIR_COLUMNS.sleeponset} / ${GGIR_COLUMNS.wakeup}`} />
        ) : rasterData && rasterData.dates.length > 0 ? (
          <div className="rounded-lg border bg-card p-4">
            <div className="h-[400px]">
              <PlotlyChart
                data={[
                  {
                    type: "scatter",
                    mode: "lines",
                    x: rasterData.dates.flatMap(() => [0, 1440, null]),
                    y: rasterData.dates.flatMap((d) => [d, d, null]),
                    line: { color: "#d9f99d", width: 14 },
                    name: "Day (noon-noon)",
                    hoverinfo: "skip",
                  },
                  {
                    type: "scatter",
                    mode: "lines",
                    x: rasterData.dates.flatMap((_d, i) => [
                      rasterData.onsetMins[i],
                      rasterData.wakeMins[i],
                      null,
                    ]),
                    y: rasterData.dates.flatMap((d) => [d, d, null]),
                    line: { color: "hsl(var(--chart-2))", width: 12 },
                    name: "SPT window",
                    text: rasterData.entries.flatMap((e) => [
                      `${decimalHourToTime(e.onset)} - ${decimalHourToTime(e.wake)}`,
                      `${decimalHourToTime(e.onset)} - ${decimalHourToTime(e.wake)}`,
                      "",
                    ]),
                    hovertemplate: "Window: %{text}<extra></extra>",
                  },
                  ...(rasterData.hasWaso
                    ? [
                        {
                          type: "scatter",
                          mode: "lines",
                          x: rasterData.dates.flatMap((_d, i) => {
                            const waso = rasterData.wasoMins[i];
                            if (waso == null || waso <= 0) return [null, null, null];
                            const end = rasterData.wakeMins[i];
                            const start = Math.max(rasterData.onsetMins[i], end - waso);
                            return [start, end, null];
                          }),
                          y: rasterData.dates.flatMap((d) => [d, d, null]),
                          line: { color: "#f59e0b", width: 8 },
                          name: "WASO",
                          text: rasterData.wasoMins.flatMap((w) => [
                            w != null ? `${w.toFixed(1)} min` : "",
                            w != null ? `${w.toFixed(1)} min` : "",
                            "",
                          ]),
                          hovertemplate: "WASO: %{text}<extra></extra>",
                        } as const,
                      ]
                    : []),
                ]}
                layout={{
                  ...transparentLayout,
                  xaxis: {
                    title: { text: "Time of Day" },
                    range: [0, 1440],
                    ...noonAxisTicks,
                  },
                  yaxis: {
                    autorange: "reversed" as const,
                    title: { text: "Day" },
                  },
                  margin: { t: 30, b: 60, l: 100, r: 20 },
                  showlegend: true,
                }}
              />
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No sleep data for the selected days.</p>
        )}
      </section>

      {/* Sleep Regularity */}
      <section className="space-y-3">
        <h3 className="text-base font-semibold">Sleep Regularity</h3>
        {!hasSleepData ? (
          <MissingColumn name={`${GGIR_COLUMNS.sleeponset} / ${GGIR_COLUMNS.wakeup}`} />
        ) : regularityData && regularityData.dates.length > 0 ? (
          <div className="rounded-lg border bg-card p-4">
            <div className="h-[300px]">
              <PlotlyChart
                data={[
                  {
                    x: regularityData.dates,
                    y: regularityData.onsetTimes,
                    type: "scatter" as const,
                    mode: "lines+markers" as const,
                    name: "Sleep Onset",
                    marker: { color: "hsl(var(--chart-4))" },
                    text: regularityData.onsetTimes.map((v) =>
                      v !== null ? decimalHourToTime(v) : "N/A"
                    ),
                    hovertemplate: "%{x}<br>Onset: %{text}<extra></extra>",
                  },
                  {
                    x: regularityData.dates,
                    y: regularityData.wakeTimes,
                    type: "scatter" as const,
                    mode: "lines+markers" as const,
                    name: "Wake Up",
                    marker: { color: "hsl(var(--chart-5))" },
                    text: regularityData.wakeTimes.map((v) =>
                      v !== null ? decimalHourToTime(v) : "N/A"
                    ),
                    hovertemplate: "%{x}<br>Wake: %{text}<extra></extra>",
                  },
                ]}
                layout={{
                  ...transparentLayout,
                  xaxis: { title: { text: "Day" } },
                  yaxis: {
                    title: { text: "Time" },
                    tickmode: "array",
                    tickvals: Array.from({ length: 16 }, (_, i) => i * 2),
                    ticktext: Array.from({ length: 16 }, (_, i) =>
                      decimalHourToTime(i * 2)
                    ),
                    range: [0, 30],
                  },
                  margin: { t: 30, b: 60, l: 60, r: 20 },
                  showlegend: true,
                  legend: { orientation: "h" as const, y: 1.1 },
                }}
              />
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No sleep data for the selected days.</p>
        )}
      </section>

      {/* Hypnogram (multiple horizontal box plots) */}
      <section className="space-y-3">
        <h3 className="text-base font-semibold">Hypnogram</h3>
        {hypnogramInput.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No sleep onset / wake-up data available for hypnogram.
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Nights shown: {hypnogramInput.length}
            </p>
            <SleepHypnogram data={hypnogramInput} />
          </>
        )}
      </section>

      {/* Sleep Duration Distribution */}
      <section className="space-y-3">
        <h3 className="text-base font-semibold">Sleep Duration Distribution</h3>
        {!sleepDurations ? (
          <MissingColumn name={GGIR_COLUMNS.durSptSleepMin} />
        ) : (
          <div className="rounded-lg border bg-card p-4">
            <div className="h-[280px]">
              <PlotlyChart
                data={[
                  {
                    x: sleepDurations,
                    type: "box" as const,
                    orientation: "h" as const,
                    name: "Sleep duration (hours)",
                    boxmean: "sd" as const,
                    marker: {
                      color: "hsl(var(--chart-2))",
                    },
                    line: {
                      color: "hsl(var(--chart-2))",
                    },
                  },
                ]}
                layout={{
                  ...transparentLayout,
                  xaxis: {
                    title: { text: "Sleep duration (hours)" },
                    zeroline: true,
                    zerolinewidth: 1,
                  },
                  yaxis: {
                    showticklabels: false,
                  },
                  margin: { t: 20, b: 60, l: 40, r: 20 },
                  showlegend: true,
                }}
              />
            </div>
          </div>
        )}
      </section>

    </div>
  );
}
