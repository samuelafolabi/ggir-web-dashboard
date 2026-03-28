import PlotlyChart from "@/components/PlotlyChart";
import type { EpochRow } from "@/lib/epochs";
import type { Data, Layout } from "plotly.js";

function epochToHour(timenum: number): number {
  return new Date(timenum * 1000).getUTCHours();
}

type Props = {
  epochs: EpochRow[];
  multiDayEpochs?: EpochRow[][];
};

export function HourlyProfileChart({ epochs, multiDayEpochs }: Props) {
  const allEpochs = multiDayEpochs && multiDayEpochs.length > 1
    ? multiDayEpochs.flat()
    : epochs;

  if (allEpochs.length === 0) return null;

  // Compute mean and SD of acc per hour
  const hourBuckets: number[][] = Array.from({ length: 24 }, () => []);
  for (const e of allEpochs) {
    hourBuckets[epochToHour(e.timenum)].push(e.acc);
  }

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const hourLabels = hours.map((h) => `${h.toString().padStart(2, "0")}:00`);
  const means = hourBuckets.map((b) =>
    b.length > 0 ? b.reduce((a, c) => a + c, 0) / b.length : null
  );
  const sds = hourBuckets.map((b, i) => {
    if (b.length < 2 || means[i] == null) return null;
    return Math.sqrt(b.reduce((s, v) => s + (v - means[i]!) ** 2, 0) / (b.length - 1));
  });

  const upper = means.map((m, i) => (m != null && sds[i] != null ? m + sds[i]! : null));
  const lower = means.map((m, i) =>
    m != null && sds[i] != null ? Math.max(0, m - sds[i]!) : null
  );

  const sdBand: Data = {
    x: [...hourLabels, ...hourLabels.slice().reverse()],
    y: [...upper, ...lower.slice().reverse()],
    fill: "toself",
    fillcolor: "rgba(37, 99, 235, 0.12)",
    line: { color: "transparent" },
    type: "scatter",
    name: "±1 SD",
    showlegend: true,
    hoverinfo: "skip",
  };

  const meanLine: Data = {
    x: hourLabels,
    y: means,
    type: "scatter",
    mode: "lines+markers",
    line: { color: "#2563eb", width: 2 },
    marker: { size: 5 },
    name: "Mean Acceleration",
    hovertemplate: "%{x}<br>Mean: %{y:.1f} mg<extra></extra>",
  };

  const daysUsed = multiDayEpochs && multiDayEpochs.length > 1
    ? multiDayEpochs.length
    : 1;

  const layout: Partial<Layout> = {
    title: { text: `Hourly Average Profile (${daysUsed} day${daysUsed > 1 ? "s" : ""})`, font: { size: 14 } },
    xaxis: { title: { text: "Hour of Day" } },
    yaxis: { title: { text: "Acceleration (mg)" }, rangemode: "tozero" },
    margin: { t: 40, r: 20, b: 50, l: 60 },
    showlegend: true,
    legend: { orientation: "h", y: -0.2 },
    height: 350,
  };

  return (
    <PlotlyChart
      data={[sdBand, meanLine]}
      layout={layout}
      config={{ responsive: true, displayModeBar: true }}
    />
  );
}
