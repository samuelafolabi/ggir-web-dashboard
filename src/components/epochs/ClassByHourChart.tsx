import PlotlyChart from "@/components/PlotlyChart";
import type { EpochRow } from "@/lib/epochs";
import { CLASS_LABELS, CLASS_COLORS } from "@/lib/epochs";
import type { Data, Layout } from "plotly.js";

function epochToHour(timenum: number): number {
  return new Date(timenum * 1000).getUTCHours();
}

type Props = { epochs: EpochRow[] };

export function ClassByHourChart({ epochs }: Props) {
  if (epochs.length === 0) return null;

  // Count epochs per (hour, class_id)
  const grid = new Map<number, Map<number, number>>();
  const allClasses = new Set<number>();
  for (const e of epochs) {
    const h = epochToHour(e.timenum);
    allClasses.add(e.class_id);
    if (!grid.has(h)) grid.set(h, new Map());
    const hourMap = grid.get(h)!;
    hourMap.set(e.class_id, (hourMap.get(e.class_id) ?? 0) + 1);
  }

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const hourLabels = hours.map((h) => `${h.toString().padStart(2, "0")}:00`);
  const sortedClasses = Array.from(allClasses).sort((a, b) => a - b);

  const traces: Data[] = sortedClasses.map((classId) => ({
    x: hourLabels,
    y: hours.map((h) => grid.get(h)?.get(classId) ?? 0),
    name: CLASS_LABELS[classId] ?? `Class ${classId}`,
    type: "bar",
    marker: { color: CLASS_COLORS[classId] ?? "#6b7280" },
  }));

  const layout: Partial<Layout> = {
    title: { text: "Activity Class by Hour of Day", font: { size: 14 } },
    barmode: "stack",
    xaxis: { title: { text: "Hour" } },
    yaxis: { title: { text: "Epoch Count" } },
    margin: { t: 40, r: 20, b: 50, l: 60 },
    showlegend: true,
    legend: { orientation: "h", y: -0.25, font: { size: 10 } },
    height: 400,
  };

  return (
    <PlotlyChart
      data={traces}
      layout={layout}
      config={{ responsive: true, displayModeBar: true }}
    />
  );
}
