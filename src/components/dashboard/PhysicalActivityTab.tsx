import { useMemo } from "react";
import { AlertCircle } from "lucide-react";
import PlotlyChart from "@/components/PlotlyChart";
import { useData } from "@/context/DataContext";
import {
  GGIR_COLUMNS,
  hasColumn,
  toNumber,
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

  const transparentLayout = {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { color: "hsl(var(--foreground))" },
  };

  // ── Intensity Donut ─────────────────────────────────────────────────
  const intensity = useMemo(
    () => computeIntensityBreakdown(filteredRows, columns),
    [filteredRows, columns]
  );

  // ── Daily Acceleration Chart ────────────────────────────────────────
  const hasAccel = hasColumn(columns, GGIR_COLUMNS.accDayMg);

  const accelData = useMemo(() => {
    if (!hasAccel) return null;
    const dates = getDayLabels(filteredRows, columns);
    const values = filteredRows.map((r) => {
      const v = toNumber(r[GGIR_COLUMNS.accDayMg]);
      return v !== null ? convertAcceleration(v, accelUnit) : null;
    });
    return { dates, values };
  }, [filteredRows, hasAccel, accelUnit, columns]);

  // ── MVPA Bouts ──────────────────────────────────────────────────────
  const hasMvpa = hasColumn(columns, GGIR_COLUMNS.durDayMvpa);

  const mvpaData = useMemo(() => {
    if (!hasMvpa) return null;
    const dates = getDayLabels(filteredRows, columns);
    const values = filteredRows.map((r) => toNumber(r[GGIR_COLUMNS.durDayMvpa]) ?? 0);
    return { dates, values };
  }, [filteredRows, hasMvpa, columns]);

  const hasAnyIntensity = intensity !== null;

  return (
    <div className="space-y-8">
      {/* Intensity Donut */}
      <section className="space-y-3">
        <h3 className="text-base font-semibold">Activity Intensity Distribution</h3>
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
                  ...transparentLayout,
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
                  ...transparentLayout,
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
                  ...transparentLayout,
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
