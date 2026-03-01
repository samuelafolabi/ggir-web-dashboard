import PlotlyChart from "@/components/PlotlyChart";
import { formatDate } from "@/lib/ggir";
import type { Data, Layout } from "plotly.js";

type DayEpochs = {
  calendar_date: string;
  weekday: string;
  epochs: { timenum: number; class_id: number; spt: boolean; invalid: boolean; acc?: number }[];
};

function epochToHour(timenum: number): number {
  return new Date(timenum * 1000).getUTCHours();
}

type Props = {
  days: DayEpochs[];
  multiDayEpochsFull?: { calendar_date: string; epochs: { timenum: number; acc: number }[] }[];
};

export function ActivityHeatmap({ days, multiDayEpochsFull }: Props) {
  if (days.length === 0) return null;

  const dayLabels = days.map((d) => {
    const formatted = formatDate(d.calendar_date);
    return d.weekday ? `${d.weekday} (${formatted})` : formatted || d.calendar_date;
  });

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const hourLabels = hours.map((h) => `${h.toString().padStart(2, "0")}:00`);

  // Build z matrix: rows = days, cols = hours, value = mean acc (or epoch count if no acc)
  const z: (number | null)[][] = [];

  if (multiDayEpochsFull && multiDayEpochsFull.length > 0) {
    for (const day of multiDayEpochsFull) {
      const hourBuckets: number[][] = Array.from({ length: 24 }, () => []);
      for (const e of day.epochs) {
        hourBuckets[epochToHour(e.timenum)].push(e.acc);
      }
      z.push(hourBuckets.map((b) => (b.length > 0 ? b.reduce((a, c) => a + c, 0) / b.length : null)));
    }
  } else {
    for (const day of days) {
      const hourCounts: number[] = new Array(24).fill(0);
      for (const e of day.epochs) {
        hourCounts[epochToHour(e.timenum)]++;
      }
      z.push(hourCounts.map((c) => (c > 0 ? c : null)));
    }
  }

  const trace: Data = {
    z,
    x: hourLabels,
    y: dayLabels,
    type: "heatmap",
    colorscale: "YlOrRd",
    colorbar: {
      title: { text: multiDayEpochsFull ? "Mean Acc (mg)" : "Epoch Count", side: "right" },
      thickness: 15,
    },
    hovertemplate: "%{y}<br>%{x}<br>Value: %{z:.1f}<extra></extra>",
  };

  const layout: Partial<Layout> = {
    title: { text: "Activity Heatmap (Days x Hours)", font: { size: 14 } },
    xaxis: { title: { text: "Hour of Day" }, side: "bottom" },
    yaxis: { autorange: "reversed" as const },
    margin: { t: 40, r: 20, b: 50, l: 160 },
    height: Math.max(250, days.length * 50 + 100),
  };

  return (
    <PlotlyChart
      data={[trace]}
      layout={layout}
      config={{ responsive: true, displayModeBar: true }}
    />
  );
}
