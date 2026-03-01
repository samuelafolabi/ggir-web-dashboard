import PlotlyChart from "@/components/PlotlyChart";
import type { EpochRow } from "@/lib/epochs";
import { CLASS_LABELS, CLASS_COLORS } from "@/lib/epochs";
import type { Data, Layout } from "plotly.js";

type Props = { epochs: EpochRow[] };

export function AccByClassBoxPlot({ epochs }: Props) {
  if (epochs.length === 0) return null;

  // Group acc values by class_id
  const groups = new Map<number, number[]>();
  for (const e of epochs) {
    if (!groups.has(e.class_id)) groups.set(e.class_id, []);
    groups.get(e.class_id)!.push(e.acc);
  }

  const sortedClasses = Array.from(groups.keys()).sort((a, b) => a - b);

  const traces: Data[] = sortedClasses.map((classId) => {
    const values = groups.get(classId)!;
    // Subsample if too many points to keep rendering fast
    const sampled = values.length > 2000
      ? values.filter((_, i) => i % Math.ceil(values.length / 2000) === 0)
      : values;

    return {
      y: sampled,
      type: "box",
      name: CLASS_LABELS[classId] ?? `Class ${classId}`,
      marker: { color: CLASS_COLORS[classId] ?? "#6b7280" },
      boxmean: true,
      jitter: 0.3,
      pointpos: 0,
      boxpoints: false,
    } as Data;
  });

  const layout: Partial<Layout> = {
    title: { text: "Acceleration by Behavioral Class", font: { size: 14 } },
    xaxis: { title: { text: "Class" } },
    yaxis: { title: { text: "Acceleration (mg)" }, rangemode: "tozero" },
    margin: { t: 40, r: 20, b: 80, l: 60 },
    showlegend: false,
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
