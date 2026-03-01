import { useMemo } from "react";
import { AlertCircle } from "lucide-react";
import PlotlyChart from "@/components/PlotlyChart";
import { Badge } from "@/components/ui/badge";
import { useData } from "@/context/DataContext";
import { GGIR_COLUMNS, hasColumn, toNumber, getDayLabels } from "@/lib/ggir";

function MissingColumn({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-dashed p-6 text-sm text-muted-foreground">
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span>Column <code className="font-mono text-xs">{name}</code> not found in this file.</span>
    </div>
  );
}

export function DataQualityTab() {
  const { data, filteredRows } = useData();
  const columns = data?.columns ?? [];

  // ── Non-Wear Chart ──────────────────────────────────────────────────
  const hasNonwear = hasColumn(columns, GGIR_COLUMNS.nonwearPercDay);

  const nonwearData = useMemo(() => {
    if (!hasNonwear) return null;
    const dates = getDayLabels(filteredRows, columns);
    const values = filteredRows.map((r) => toNumber(r[GGIR_COLUMNS.nonwearPercDay]) ?? 0);
    return { dates, values };
  }, [filteredRows, hasNonwear, columns]);

  // ── Clipping Score Chart (not standard in GGIR data model, but may exist in some files) ──
  const hasClipping = hasColumn(columns, "clipping_score");

  const clippingData = useMemo(() => {
    if (!hasClipping) return null;
    const dates = getDayLabels(filteredRows, columns);
    const values = filteredRows.map((r) => toNumber(r["clipping_score"]) ?? 0);
    return { dates, values };
  }, [filteredRows, hasClipping, columns]);

  // ── Calibration Error ───────────────────────────────────────────────
  const calibCol = hasColumn(columns, GGIR_COLUMNS.calibErr)
    ? GGIR_COLUMNS.calibErr
    : hasColumn(columns, GGIR_COLUMNS.calErrorEnd)
    ? GGIR_COLUMNS.calErrorEnd
    : null;
  const hasCalib = calibCol !== null;

  const calibError = useMemo(() => {
    if (!calibCol || filteredRows.length === 0) return null;
    const vals = filteredRows
      .map((r) => toNumber(r[calibCol]))
      .filter((v): v is number => v !== null);
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [filteredRows, calibCol]);

  const transparentLayout = {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { color: "hsl(var(--foreground))" },
  };

  return (
    <div className="space-y-8">
      {/* Non-Wear Percentage */}
      <section className="space-y-3">
        <h3 className="text-base font-semibold">Non-Wear Percentage per Day</h3>
        {!hasNonwear ? (
          <MissingColumn name={GGIR_COLUMNS.nonwearPercDay} />
        ) : nonwearData && (
          <div className="rounded-lg border bg-card p-4">
            <div className="h-[350px]">
              <PlotlyChart
                data={[
                  {
                    z: [nonwearData.values],
                    x: nonwearData.dates,
                    y: ["Non-Wear %"],
                    type: "heatmap" as const,
                    colorscale: [
                      [0, "#22c55e"],
                      [0.5, "#eab308"],
                      [1, "#ef4444"],
                    ],
                    zmin: 0,
                    zmax: 100,
                    colorbar: { title: { text: "%" } },
                    hoverongaps: false,
                  },
                ]}
                layout={{
                  ...transparentLayout,
                  xaxis: { title: { text: "Day" } },
                  margin: { t: 30, b: 60, l: 80, r: 20 },
                }}
              />
            </div>
          </div>
        )}
      </section>

      {/* Clipping Score */}
      <section className="space-y-3">
        <h3 className="text-base font-semibold">Signal Clipping Score</h3>
        {!hasClipping ? (
          <MissingColumn name="clipping_score" />
        ) : clippingData && (
          <div className="rounded-lg border bg-card p-4">
            <div className="h-[300px]">
              <PlotlyChart
                data={[
                  {
                    x: clippingData.dates,
                    y: clippingData.values,
                    type: "bar" as const,
                    marker: { color: "hsl(var(--chart-1))" },
                    name: "Clipping Score",
                  },
                ]}
                layout={{
                  ...transparentLayout,
                  xaxis: { title: { text: "Day" } },
                  yaxis: { title: { text: "Clipping Score" } },
                  margin: { t: 30, b: 60, l: 60, r: 20 },
                }}
              />
            </div>
          </div>
        )}
      </section>

      {/* Calibration Error */}
      <section className="space-y-3">
        <h3 className="text-base font-semibold">Calibration Error</h3>
        {!hasCalib ? (
          <MissingColumn name={GGIR_COLUMNS.calibErr} />
        ) : (
          <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
            <span className="text-sm">
              Mean post-calibration error:{" "}
              <span className="font-mono font-semibold">
                {calibError !== null ? calibError.toFixed(6) : "N/A"}
              </span>
            </span>
            {calibError !== null && (
              <Badge variant={calibError <= 0.01 ? "default" : "destructive"}>
                {calibError <= 0.01 ? "Pass" : "Fail"}
              </Badge>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
