import PlotlyChart from "@/components/PlotlyChart";
import type { EpochRow } from "@/lib/epochs";
import type { Data, Layout } from "plotly.js";

type Props = { epochs: EpochRow[] };

export function AccHistogram({ epochs }: Props) {
  if (epochs.length === 0) return null;

  const accValues = epochs.map((e) => e.acc);

  const histTrace: Data = {
    x: accValues,
    type: "histogram",
    xbins: {
      start: Math.min(...accValues),
      end: Math.max(...accValues),
      size: (Math.max(...accValues) - Math.min(...accValues)) / 60 || 1,
    },
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

  const layout: Partial<Layout> = {
    title: { text: "Acceleration Distribution", font: { size: 14 } },
    xaxis: { title: { text: "Acceleration (mg)" } },
    yaxis: { title: { text: "Count" } },
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
        text: `SD: ${std.toFixed(1)} mg<br>P5: ${p5.toFixed(1)}<br>P95: ${p95.toFixed(1)}`,
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
