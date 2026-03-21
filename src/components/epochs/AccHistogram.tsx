import PlotlyChart from "@/components/PlotlyChart";
import type { EpochRow } from "@/lib/epochs";
import type { Data, Layout } from "plotly.js";

type Props = { epochs: EpochRow[] };

type HistogramScale = "linear" | "log";
type HistogramProps = Props & { xScale?: HistogramScale };

export function AccHistogram({ epochs, xScale = "linear" }: HistogramProps) {
  if (epochs.length === 0) return null;

  const allAccValues = epochs.map((e) => e.acc).filter((v) => Number.isFinite(v));
  const accValues = xScale === "log" ? allAccValues.filter((v) => v > 0) : allAccValues;
  const excludedForLog = allAccValues.length - accValues.length;
  if (accValues.length === 0) return null;

  const minAcc = Math.min(...accValues);
  const maxAcc = Math.max(...accValues);
  const logBinData =
    xScale === "log" && minAcc > 0 && maxAcc > minAcc
      ? (() => {
          const binCount = 24;
          const minLog = Math.log10(minAcc);
          const maxLog = Math.log10(maxAcc);
          const binWidth = (maxLog - minLog) / binCount;
          const bins = Array.from({ length: binCount }, () => 0);
          const lowerEdges = Array.from({ length: binCount }, (_, i) => 10 ** (minLog + i * binWidth));
          const upperEdges = Array.from({ length: binCount }, (_, i) => 10 ** (minLog + (i + 1) * binWidth));
          for (const v of accValues) {
            const rawIndex = Math.floor((Math.log10(v) - minLog) / (binWidth || 1));
            const index = Math.max(0, Math.min(binCount - 1, rawIndex));
            bins[index] += 1;
          }
          const centers = lowerEdges.map((low, i) => Math.sqrt(low * upperEdges[i]));
          const widths = lowerEdges.map((low, i) => upperEdges[i] - low);
          return {
            binCount,
            bins,
            centers,
            widths,
            lowerEdges,
            upperEdges,
            nonZeroBins: bins.filter((c) => c > 0).length,
            maxBinCount: Math.max(...bins),
          };
        })()
      : null;
  const logCurveData =
    xScale === "log" && logBinData
      ? (() => {
          // Use exact per-log-bin counts to keep the plotted distribution faithful to source data.
          const counts = logBinData.bins;
          const nonZero = counts.filter((v) => v > 0);
          const yMin = nonZero.length > 0 ? Math.min(...nonZero) : 0;
          const yMax = counts.length > 0 ? Math.max(...counts) : 0;
          const useLogY = yMin > 0 && yMax / yMin >= 100;
          const points = counts
            .map((y, i) => ({
              x: logBinData.centers[i],
              y,
              low: logBinData.lowerEdges[i],
              high: logBinData.upperEdges[i],
            }))
            .filter((p) => !useLogY || p.y > 0);
          return {
            x: points.map((p) => p.x),
            y: points.map((p) => p.y),
            customdata: points.map((p) => [p.low, p.high]),
            yMin,
            yMax,
            useLogY,
          };
        })()
      : null;

  const histTrace: Data =
    xScale === "log" && logCurveData
      ? {
          x: logCurveData.x,
          y: logCurveData.y,
          type: "scatter",
          mode: "lines",
          line: { color: "rgba(37, 99, 235, 1)", width: 2.5, shape: "linear" },
          fill: logCurveData.useLogY ? "none" : "tozeroy",
          fillcolor: "rgba(37, 99, 235, 0.15)",
          name: "Log Distribution Curve",
          customdata: logCurveData.customdata,
          hovertemplate:
            "Range: %{customdata[0]:.2f} to %{customdata[1]:.2f} mg<br>Count: %{y}<extra></extra>",
        }
      : {
          x: accValues,
          type: "histogram",
          ...(xScale === "linear"
            ? {
                xbins: {
                  start: minAcc,
                  end: maxAcc,
                  size: (maxAcc - minAcc) / 60 || 1,
                },
              }
            : {}),
          marker: { color: "rgba(37, 99, 235, 0.6)", line: { color: "rgba(37, 99, 235, 1)", width: 1 } },
          name: "Histogram",
          yaxis: "y",
        };

  // Simple KDE approximation using a second histogram with smaller bins, smoothed
  const sorted = [...accValues].sort((a, b) => a - b);
  const p5 = sorted[Math.floor(sorted.length * 0.05)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const mean = accValues.reduce((a, b) => a + b, 0) / accValues.length;
  const std = Math.sqrt(accValues.reduce((s, v) => s + (v - mean) ** 2, 0) / accValues.length);
  const logYScaleLabel =
    xScale === "log" && logCurveData ? (logCurveData.useLogY ? "log" : "linear") : null;
  const minLogX = xScale === "log" ? Math.log10(minAcc) : 0;
  const maxLogX = xScale === "log" ? Math.log10(maxAcc) : 0;
  const logXPadding = xScale === "log" ? Math.max((maxLogX - minLogX) * 0.05, 0.03) : 0;

  const layout: Partial<Layout> = {
    title: {
      text: xScale === "log" ? "Acceleration Distribution (Log X-Scale)" : "Acceleration Distribution",
      font: { size: 14 },
    },
    xaxis: {
      title: { text: "Acceleration (mg)" },
      ...(xScale === "log"
        ? {
            type: "log",
            range: [minLogX - logXPadding, maxLogX + logXPadding],
          }
        : {}),
    },
    yaxis:
      xScale === "log" && logCurveData
        ? logCurveData.useLogY
          ? {
              title: { text: "Count (log scale)" },
              type: "log",
              range: [
                Math.log10(Math.max(logCurveData.yMin * 0.9, 1e-3)),
                Math.log10(Math.max(logCurveData.yMax * 1.1, 1e-2)),
              ],
            }
          : {
              title: { text: "Count" },
              range: [0, Math.max(logCurveData.yMax * 1.1, 1)],
            }
        : { title: { text: "Count" } },
    margin: { t: 40, r: 20, b: 50, l: 60 },
    showlegend: false,
    height: 350,
    annotations: [
      {
        x: mean,
        y: 1,
        xref: "x",
        yref: "paper",
        text: `Mean: ${mean.toFixed(1)} mg`,
        showarrow: true,
        arrowhead: 2,
        ax: 40,
        ay: -30,
        font: { size: 11, color: "#dc2626" },
      },
      {
        x: 0.98,
        y: 0.95,
        xref: "paper",
        yref: "paper",
        text:
          `SD: ${std.toFixed(1)} mg<br>P5: ${p5.toFixed(1)}<br>P95: ${p95.toFixed(1)}` +
          (xScale === "log"
            ? `<br>Y-scale: ${logYScaleLabel}${excludedForLog > 0 ? `<br>Excluded <= 0: ${excludedForLog}` : ""}`
            : ""),
        showarrow: false,
        font: { size: 10 },
        align: "right",
        bgcolor: "rgba(255,255,255,0.8)",
        bordercolor: "#d1d5db",
        borderwidth: 1,
        borderpad: 4,
      },
    ],
  };

  return (
    <PlotlyChart
      data={[histTrace]}
      layout={layout}
      config={{ responsive: true, displayModeBar: true }}
    />
  );
}
