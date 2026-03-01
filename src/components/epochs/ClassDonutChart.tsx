import PlotlyChart from "@/components/PlotlyChart";
import type { EpochRow } from "@/lib/epochs";
import { CLASS_LABELS, CLASS_COLORS } from "@/lib/epochs";
import type { Data, Layout } from "plotly.js";

type Props = { epochs: EpochRow[]; epochSeconds?: number };

export function ClassDonutChart({ epochs, epochSeconds = 5 }: Props) {
  if (epochs.length === 0) return null;

  const counts = new Map<number, number>();
  for (const e of epochs) {
    counts.set(e.class_id, (counts.get(e.class_id) ?? 0) + 1);
  }

  const sorted = Array.from(counts.entries()).sort((a, b) => a[0] - b[0]);
  const labels = sorted.map(([id]) => CLASS_LABELS[id] ?? `Class ${id}`);
  const values = sorted.map(([, cnt]) => cnt);
  const colors = sorted.map(([id]) => CLASS_COLORS[id] ?? "#6b7280");
  const minutes = sorted.map(([, cnt]) => ((cnt * epochSeconds) / 60).toFixed(1));

  const trace: Data = {
    labels,
    values,
    type: "pie",
    hole: 0.5,
    marker: { colors },
    textinfo: "percent",
    hovertemplate: "%{label}<br>%{value} epochs (%{percent})<br>" +
      minutes.map((m, i) => ``).join("") +
      "<extra></extra>",
    customdata: minutes,
    hoverinfo: "label+percent",
  };

  const layout: Partial<Layout> = {
    title: { text: "Activity Class Distribution", font: { size: 14 } },
    margin: { t: 40, r: 20, b: 20, l: 20 },
    showlegend: true,
    legend: { orientation: "h", y: -0.15, font: { size: 10 } },
    height: 400,
  };

  return (
    <PlotlyChart
      data={[trace]}
      layout={layout}
      config={{ responsive: true, displayModeBar: false }}
    />
  );
}
