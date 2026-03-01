import PlotlyChart from "@/components/PlotlyChart";
import { formatDate } from "@/lib/ggir";
import type { Data, Layout, Shape } from "plotly.js";

type DayEpochs = {
  calendar_date: string;
  weekday: string;
  epochs: { timenum: number; invalid: boolean }[];
};

function epochToHourFraction(timenum: number): number {
  const d = new Date(timenum * 1000);
  return d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
}

type Props = { days: DayEpochs[] };

export function NonWearTimeline({ days }: Props) {
  if (days.length === 0) return null;

  const dayLabels = days.map((d) => {
    const formatted = formatDate(d.calendar_date);
    return d.weekday ? `${d.weekday} (${formatted})` : formatted || d.calendar_date;
  });

  const shapes: Partial<Shape>[] = [];
  const validCounts: number[] = [];
  const invalidCounts: number[] = [];

  for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
    const day = days[dayIdx];
    let valid = 0;
    let invalid = 0;

    // Background: full day in green (valid)
    shapes.push({
      type: "rect",
      xref: "x",
      yref: "y",
      x0: 0,
      x1: 24,
      y0: dayIdx - 0.35,
      y1: dayIdx + 0.35,
      fillcolor: "rgba(34, 197, 94, 0.25)",
      line: { width: 0 },
    });

    // Overlay invalid segments in red
    let invStart: number | null = null;
    for (let i = 0; i <= day.epochs.length; i++) {
      const isInv = i < day.epochs.length && day.epochs[i].invalid;
      if (isInv) {
        invalid++;
        if (invStart === null) invStart = epochToHourFraction(day.epochs[i].timenum);
      } else {
        if (i < day.epochs.length) valid++;
        if (invStart !== null) {
          const invEnd = epochToHourFraction(day.epochs[i - 1].timenum);
          const epochDur = day.epochs.length > 1
            ? epochToHourFraction(day.epochs[1].timenum) - epochToHourFraction(day.epochs[0].timenum)
            : 5 / 3600;
          shapes.push({
            type: "rect",
            xref: "x",
            yref: "y",
            x0: invStart,
            x1: invEnd + epochDur,
            y0: dayIdx - 0.35,
            y1: dayIdx + 0.35,
            fillcolor: "rgba(239, 68, 68, 0.6)",
            line: { width: 0 },
          });
          invStart = null;
        }
      }
    }

    validCounts.push(valid);
    invalidCounts.push(invalid);
  }

  // Invisible scatter for axis rendering
  const trace: Data = {
    x: days.map(() => 12),
    y: days.map((_, i) => i),
    text: dayLabels.map((label, i) => {
      const total = validCounts[i] + invalidCounts[i];
      const pct = total > 0 ? ((invalidCounts[i] / total) * 100).toFixed(1) : "0";
      return `${label}<br>Valid: ${validCounts[i]}, Invalid: ${invalidCounts[i]} (${pct}%)`;
    }),
    type: "scatter",
    mode: "markers",
    marker: { opacity: 0, size: 1 },
    showlegend: false,
    hoverinfo: "text",
  };

  const layout: Partial<Layout> = {
    title: { text: "Non-Wear / Data Quality Timeline", font: { size: 14 } },
    xaxis: {
      title: { text: "Time of Day" },
      range: [0, 24],
      dtick: 3,
      tickvals: Array.from({ length: 9 }, (_, i) => i * 3),
      ticktext: Array.from({ length: 9 }, (_, i) => `${(i * 3).toString().padStart(2, "0")}:00`),
    },
    yaxis: {
      tickvals: days.map((_, i) => i),
      ticktext: dayLabels,
      range: [days.length - 0.5, -0.5],
      fixedrange: true,
    },
    shapes,
    margin: { t: 40, r: 20, b: 50, l: 160 },
    height: Math.max(200, days.length * 50 + 100),
    showlegend: false,
  };

  return (
    <div>
      <PlotlyChart
        data={[trace]}
        layout={layout}
        config={{ responsive: true, displayModeBar: false }}
      />
      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground justify-center">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-green-400/40" />
          Valid / Wear
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-red-400/80" />
          Invalid / Non-wear
        </span>
      </div>
    </div>
  );
}
