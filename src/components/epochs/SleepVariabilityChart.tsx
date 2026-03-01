import PlotlyChart from "@/components/PlotlyChart";
import type { DaySummary } from "@/lib/epochs";
import { formatDate } from "@/lib/ggir";
import type { Data, Layout, Shape } from "plotly.js";

function decimalHoursToTime(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`;
}

type Props = { summaries: DaySummary[] };

export function SleepVariabilityChart({ summaries }: Props) {
  const withSleep = summaries.filter((s) => s.sleeponset != null && s.wakeup != null);
  if (withSleep.length < 2) return null;

  const dates = withSleep.map((s) => formatDate(s.calendar_date) || s.calendar_date);
  const onsets = withSleep.map((s) => s.sleeponset!);
  const wakeups = withSleep.map((s) => s.wakeup!);

  const meanOnset = onsets.reduce((a, b) => a + b, 0) / onsets.length;
  const meanWakeup = wakeups.reduce((a, b) => a + b, 0) / wakeups.length;

  const onsetTrace: Data = {
    x: dates,
    y: onsets,
    type: "scatter",
    mode: "lines+markers",
    name: "Sleep Onset",
    line: { color: "#6366f1", width: 2 },
    marker: { size: 8, symbol: "circle" },
    hovertemplate: "%{x}<br>Onset: %{text}<extra></extra>",
    text: onsets.map(decimalHoursToTime),
  };

  const wakeupTrace: Data = {
    x: dates,
    y: wakeups,
    type: "scatter",
    mode: "lines+markers",
    name: "Wake Up",
    line: { color: "#eab308", width: 2 },
    marker: { size: 8, symbol: "diamond" },
    hovertemplate: "%{x}<br>Wake: %{text}<extra></extra>",
    text: wakeups.map(decimalHoursToTime),
  };

  const shapes: Partial<Shape>[] = [
    {
      type: "line",
      xref: "paper",
      yref: "y",
      x0: 0,
      x1: 1,
      y0: meanOnset,
      y1: meanOnset,
      line: { color: "#6366f1", width: 1, dash: "dash" },
    },
    {
      type: "line",
      xref: "paper",
      yref: "y",
      x0: 0,
      x1: 1,
      y0: meanWakeup,
      y1: meanWakeup,
      line: { color: "#eab308", width: 1, dash: "dash" },
    },
  ];

  const layout: Partial<Layout> = {
    title: { text: "Sleep Onset / Wakeup Variability", font: { size: 14 } },
    xaxis: { title: { text: "Day" } },
    yaxis: {
      title: { text: "Time (decimal hours)" },
      tickvals: Array.from({ length: 13 }, (_, i) => i * 2),
      ticktext: Array.from({ length: 13 }, (_, i) => `${(i * 2).toString().padStart(2, "0")}:00`),
    },
    shapes,
    margin: { t: 40, r: 20, b: 60, l: 60 },
    legend: { orientation: "h", y: -0.25 },
    height: 350,
    annotations: [
      {
        x: 1,
        y: meanOnset,
        xref: "paper",
        yref: "y",
        text: `Mean: ${decimalHoursToTime(meanOnset)}`,
        showarrow: false,
        font: { size: 10, color: "#6366f1" },
        xanchor: "left",
        xshift: 5,
      },
      {
        x: 1,
        y: meanWakeup,
        xref: "paper",
        yref: "y",
        text: `Mean: ${decimalHoursToTime(meanWakeup)}`,
        showarrow: false,
        font: { size: 10, color: "#eab308" },
        xanchor: "left",
        xshift: 5,
      },
    ],
  };

  return (
    <PlotlyChart
      data={[onsetTrace, wakeupTrace]}
      layout={layout}
      config={{ responsive: true, displayModeBar: true }}
    />
  );
}
