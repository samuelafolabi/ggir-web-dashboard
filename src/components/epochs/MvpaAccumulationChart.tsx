import PlotlyChart from "@/components/PlotlyChart";
import type { EpochRow } from "@/lib/epochs";
import { MVPA_CLASS_IDS } from "@/lib/epochs";
import type { Data, Layout, Shape } from "plotly.js";

function epochToHourFraction(timenum: number): number {
  const d = new Date(timenum * 1000);
  return d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
}

type Props = { epochs: EpochRow[]; epochSeconds?: number };

export function MvpaAccumulationChart({ epochs, epochSeconds = 5 }: Props) {
  if (epochs.length === 0) return null;

  const epochMinutes = epochSeconds / 60;
  let cumulative = 0;
  const times: number[] = [];
  const values: number[] = [];

  for (const e of epochs) {
    if (MVPA_CLASS_IDS.has(e.class_id)) {
      cumulative += epochMinutes;
    }
    times.push(epochToHourFraction(e.timenum));
    values.push(cumulative);
  }

  const totalMvpa = cumulative;
  const guidelineDaily = 150 / 7;

  const trace: Data = {
    x: times,
    y: values,
    type: "scattergl",
    mode: "lines",
    fill: "tozeroy",
    fillcolor: "rgba(22, 163, 74, 0.1)",
    line: { color: "#16a34a", width: 2 },
    name: "Cumulative MVPA",
    hovertemplate: "Time: %{x:.1f}h<br>MVPA: %{y:.1f} min<extra></extra>",
  };

  const shapes: Partial<Shape>[] = [
    {
      type: "line",
      xref: "paper",
      yref: "y",
      x0: 0,
      x1: 1,
      y0: guidelineDaily,
      y1: guidelineDaily,
      line: { color: "#dc2626", width: 1.5, dash: "dash" },
    },
  ];

  const layout: Partial<Layout> = {
    title: { text: "MVPA Accumulation Over Day", font: { size: 14 } },
    xaxis: {
      title: { text: "Time of Day" },
      range: [0, 24],
      dtick: 3,
      tickvals: Array.from({ length: 9 }, (_, i) => i * 3),
      ticktext: Array.from({ length: 9 }, (_, i) => `${(i * 3).toString().padStart(2, "0")}:00`),
    },
    yaxis: { title: { text: "Cumulative MVPA (min)" }, rangemode: "tozero" },
    shapes,
    margin: { t: 40, r: 20, b: 50, l: 60 },
    height: 350,
    annotations: [
      {
        x: 0.02,
        y: guidelineDaily,
        xref: "paper",
        yref: "y",
        text: `150 min/week guideline (${guidelineDaily.toFixed(0)} min/day)`,
        showarrow: false,
        font: { size: 10, color: "#dc2626" },
        yshift: 12,
      },
      {
        x: 0.98,
        y: 0.95,
        xref: "paper",
        yref: "paper",
        text: `Total: ${totalMvpa.toFixed(1)} min`,
        showarrow: false,
        font: { size: 12, color: "#16a34a" },
        bgcolor: "rgba(255,255,255,0.8)",
        bordercolor: "#16a34a",
        borderwidth: 1,
        borderpad: 4,
      },
    ],
    showlegend: false,
  };

  return (
    <PlotlyChart
      data={[trace]}
      layout={layout}
      config={{ responsive: true, displayModeBar: true }}
    />
  );
}
