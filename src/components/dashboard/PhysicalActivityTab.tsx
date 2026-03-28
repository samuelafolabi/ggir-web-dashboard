import { useMemo } from "react";
import { AlertCircle } from "lucide-react";
import PlotlyChart from "@/components/PlotlyChart";
import { useData } from "@/context/DataContext";
import {
  GGIR_COLUMNS,
  hasColumn,
  toNumber,
  toString,
  getDayLabels,
  computeIntensityBreakdown,
  convertAcceleration,
  accelUnitLabel,
} from "@/lib/ggir";

function MissingColumn({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-dashed p-6 text-sm text-muted-foreground">
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span>Column <code className="font-mono text-xs">{name}</code> not found in this file.</span>
    </div>
  );
}

export function PhysicalActivityTab() {
  const { data, filteredRows, accelUnit } = useData();
  const columns = data?.columns ?? [];

  const fixedLightLayout = {
    paper_bgcolor: "#ffffff",
    plot_bgcolor: "#ffffff",
    font: { color: "#111827" },
  };

  // Some files contain duplicate rows per day; aggregate to one row/day so
  // day-level charts and means are not inflated.
  const dayRows = useMemo(() => {
    const byDate = new Map<
      string,
      {
        base: Record<string, unknown>;
        acc: number[];
        mvpa: number[];
        in: number[];
        lig: number[];
        mod: number[];
        vig: number[];
      }
    >();

    for (const r of filteredRows) {
      const rawDate = toString(r[GGIR_COLUMNS.calendarDate]);
      if (!rawDate) continue;
      if (!byDate.has(rawDate)) {
        byDate.set(rawDate, {
          base: { ...(r as Record<string, unknown>) },
          acc: [],
          mvpa: [],
          in: [],
          lig: [],
          mod: [],
          vig: [],
        });
      }
      const bucket = byDate.get(rawDate)!;
      const acc = toNumber(r[GGIR_COLUMNS.accDayMg]);
      const mvpa = toNumber(r[GGIR_COLUMNS.durDayMvpa]);
      const inVal = toNumber(r[GGIR_COLUMNS.durDayTotalIn]);
      const ligVal = toNumber(r[GGIR_COLUMNS.durDayTotalLig]);
      const modVal = toNumber(r[GGIR_COLUMNS.durDayTotalMod]);
      const vigVal = toNumber(r[GGIR_COLUMNS.durDayTotalVig]);
      if (acc != null) bucket.acc.push(acc);
      if (mvpa != null) bucket.mvpa.push(mvpa);
      if (inVal != null) bucket.in.push(inVal);
      if (ligVal != null) bucket.lig.push(ligVal);
      if (modVal != null) bucket.mod.push(modVal);
      if (vigVal != null) bucket.vig.push(vigVal);
    }

    const mean = (vals: number[]) =>
      vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, bucket]) => ({
        ...bucket.base,
        [GGIR_COLUMNS.accDayMg]: mean(bucket.acc),
        [GGIR_COLUMNS.durDayMvpa]: mean(bucket.mvpa),
        [GGIR_COLUMNS.durDayTotalIn]: mean(bucket.in),
        [GGIR_COLUMNS.durDayTotalLig]: mean(bucket.lig),
        [GGIR_COLUMNS.durDayTotalMod]: mean(bucket.mod),
        [GGIR_COLUMNS.durDayTotalVig]: mean(bucket.vig),
      }));
  }, [filteredRows]);

  // ── Intensity Donut ─────────────────────────────────────────────────
  const intensity = useMemo(
    () => computeIntensityBreakdown(dayRows, columns),
    [dayRows, columns]
  );

  // ── Daily Acceleration Chart ────────────────────────────────────────
  const hasAccel = hasColumn(columns, GGIR_COLUMNS.accDayMg);

  const accelData = useMemo(() => {
    if (!hasAccel) return null;
    const dates = getDayLabels(dayRows, columns);
    const values = dayRows.map((r) => {
      const v = toNumber(r[GGIR_COLUMNS.accDayMg]);
      return v !== null ? convertAcceleration(v, accelUnit) : null;
    });
    return { dates, values };
  }, [dayRows, hasAccel, accelUnit, columns]);

  // ── MVPA Bouts ──────────────────────────────────────────────────────
  const hasMvpa = hasColumn(columns, GGIR_COLUMNS.durDayMvpa);

  const mvpaData = useMemo(() => {
    if (!hasMvpa) return null;
    const dates = getDayLabels(dayRows, columns);
    const values = dayRows.map((r) => toNumber(r[GGIR_COLUMNS.durDayMvpa]) ?? 0);
    return { dates, values };
  }, [dayRows, hasMvpa, columns]);

  const hasAnyIntensity = intensity !== null;

  return (
    <div className="space-y-8">
      {/* Intensity Donut */}
      <section className="space-y-3">
        <h3 className="text-base font-semibold">Activity Intensity Distribution</h3>
        <p className="text-sm text-muted-foreground">
          Shows average daily minutes by intensity band (sedentary, light, moderate, vigorous).
        </p>
        {!hasAnyIntensity ? (
          <MissingColumn name="dur_day_total_*_min" />
        ) : (
          <div className="rounded-lg border bg-card p-4">
            <div className="h-[350px]">
              <PlotlyChart
                data={[
                  {
                    values: [
                      intensity.sedentary,
                      intensity.light,
                      intensity.moderate,
                      intensity.vigorous,
                    ],
                    labels: ["Sedentary", "Light", "Moderate", "Vigorous"],
                    type: "pie" as const,
                    hole: 0.5,
                    marker: {
                      colors: [
                        "hsl(var(--chart-3))",
                        "hsl(var(--chart-2))",
                        "hsl(var(--chart-4))",
                        "hsl(var(--chart-5))",
                      ],
                    },
                    textinfo: "label+percent" as const,
                    hoverinfo: "label+value+percent" as const,
                  },
                ]}
                layout={{
                  ...fixedLightLayout,
                  margin: { t: 30, b: 30, l: 30, r: 30 },
                  showlegend: true,
                  legend: { orientation: "h" as const, y: -0.1 },
                  annotations: [
                    {
                      text: "Daily Avg<br>(min)",
                      showarrow: false,
                      font: { size: 12 },
                    },
                  ],
                }}
              />
            </div>
          </div>
        )}
      </section>

      {/* Daily Acceleration */}
      <section className="space-y-3">
        <h3 className="text-base font-semibold">
          Daily Average Acceleration ({accelUnitLabel(accelUnit)})
        </h3>
        <p className="text-sm text-muted-foreground">
          Higher bars indicate greater overall movement intensity for that day.
        </p>
        {!hasAccel ? (
          <MissingColumn name={GGIR_COLUMNS.accDayMg} />
        ) : accelData && (
          <div className="rounded-lg border bg-card p-4">
            <div className="h-[300px]">
              <PlotlyChart
                data={[
                  {
                    x: accelData.dates,
                    y: accelData.values,
                    type: "bar" as const,
                    marker: { color: "hsl(var(--chart-1))" },
                    name: `ENMO (${accelUnitLabel(accelUnit)})`,
                  },
                ]}
                layout={{
                  ...fixedLightLayout,
                  xaxis: { title: { text: "Day" } },
                  yaxis: { title: { text: accelUnitLabel(accelUnit) } },
                  margin: { t: 30, b: 60, l: 60, r: 20 },
                }}
              />
            </div>
          </div>
        )}
      </section>

      {/* MVPA Bouts */}
      <section className="space-y-3">
        <h3 className="text-base font-semibold">Daily MVPA (Moderate-to-Vigorous)</h3>
        <p className="text-sm text-muted-foreground">
          Daily MVPA minutes with a dashed reference for the 150 min/week target (~21.4 min/day).
        </p>
        {!hasMvpa ? (
          <MissingColumn name={GGIR_COLUMNS.durDayMvpa} />
        ) : mvpaData && (
          <div className="rounded-lg border bg-card p-4">
            <div className="h-[300px]">
              <PlotlyChart
                data={[
                  {
                    x: mvpaData.dates,
                    y: mvpaData.values,
                    type: "bar" as const,
                    marker: { color: "hsl(var(--chart-4))" },
                    name: "MVPA (min)",
                  },
                ]}
                layout={{
                  ...fixedLightLayout,
                  xaxis: { title: { text: "Day" } },
                  yaxis: { title: { text: "Minutes" } },
                  margin: { t: 30, b: 60, l: 60, r: 20 },
                  shapes: [
                    {
                      type: "line",
                      x0: 0,
                      x1: 1,
                      xref: "paper",
                      y0: 21.4,
                      y1: 21.4,
                      line: {
                        color: "hsl(var(--chart-5))",
                        width: 2,
                        dash: "dash",
                      },
                    },
                  ],
                  annotations: [
                    {
                      x: 1,
                      xref: "paper",
                      y: 21.4,
                      text: "150 min/week guideline",
                      showarrow: false,
                      xanchor: "right" as const,
                      yanchor: "bottom" as const,
                      font: { size: 10, color: "hsl(var(--chart-5))" },
                    },
                  ],
                }}
              />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
