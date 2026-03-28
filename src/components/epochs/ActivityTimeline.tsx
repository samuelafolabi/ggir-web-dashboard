import PlotlyChart from "@/components/PlotlyChart";
import type { EpochRow, DaySummary } from "@/lib/epochs";
import { CLASS_COLORS, CLASS_LABELS } from "@/lib/epochs";
import type { Data, Layout, Shape } from "plotly.js";

function epochToTimeOfDay(timenum: number): string {
  const d = new Date(timenum * 1000);
  return `${d.getUTCHours().toString().padStart(2, "0")}:${d.getUTCMinutes().toString().padStart(2, "0")}:${d.getUTCSeconds().toString().padStart(2, "0")}`;
}

function epochToHourFraction(timenum: number): number {
  const d = new Date(timenum * 1000);
  return d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
}

function decimalHoursToTime(h: number): string {
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

function inferEpochHours(epochs: EpochRow[]): number {
  if (epochs.length < 2) return 5 / 3600;
  const deltas: number[] = [];
  for (let i = 1; i < epochs.length; i++) {
    const d = epochs[i].timenum - epochs[i - 1].timenum;
    if (Number.isFinite(d) && d > 0) deltas.push(d);
  }
  if (deltas.length === 0) return 5 / 3600;
  deltas.sort((a, b) => a - b);
  const medianSec = deltas[Math.floor(deltas.length / 2)];
  return medianSec / 3600;
}

type Props = {
  epochs: EpochRow[];
  summary: DaySummary | null;
  dateLabel: string;
};

export function ActivityTimeline({ epochs, summary, dateLabel }: Props) {
  if (epochs.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground text-sm">
        No epoch data available for this day.
      </div>
    );
  }

  const times = epochs.map((e) => epochToTimeOfDay(e.timenum));
  const hours = epochs.map((e) => epochToHourFraction(e.timenum));
  const accValues = epochs.map((e) => e.acc);
  const epochHours = inferEpochHours(epochs);

  // Build color-coded background bands by class_id
  const shapes: Partial<Shape>[] = [];

  // SPT regions
  let sptStart: number | null = null;
  for (let i = 0; i <= epochs.length; i++) {
    const inSpt = i < epochs.length && epochs[i].spt;
    if (inSpt && sptStart === null) {
      sptStart = hours[i];
    } else if (!inSpt && sptStart !== null) {
      shapes.push({
        type: "rect",
        xref: "x",
        yref: "paper",
        x0: sptStart,
        x1: hours[i - 1] + epochHours,
        y0: 0,
        y1: 1,
        fillcolor: "rgba(59, 130, 246, 0.08)",
        line: { width: 1, color: "rgba(59, 130, 246, 0.3)", dash: "dot" },
        layer: "below",
      });
      sptStart = null;
    }
  }

  // Invalid/non-wear regions
  let invStart: number | null = null;
  for (let i = 0; i <= epochs.length; i++) {
    const isInvalid = i < epochs.length && epochs[i].invalid;
    if (isInvalid && invStart === null) {
      invStart = hours[i];
    } else if (!isInvalid && invStart !== null) {
      shapes.push({
        type: "rect",
        xref: "x",
        yref: "paper",
        x0: invStart,
        x1: hours[i - 1] + epochHours,
        y0: 0,
        y1: 1,
        fillcolor: "rgba(239, 68, 68, 0.08)",
        line: { width: 1, color: "rgba(239, 68, 68, 0.4)", dash: "dash" },
        layer: "below",
      });
      invStart = null;
    }
  }

  // Sleep onset / wakeup vertical lines
  if (summary?.sleeponset != null) {
    shapes.push({
      type: "line",
      xref: "x",
      yref: "paper",
      x0: summary.sleeponset,
      x1: summary.sleeponset,
      y0: 0,
      y1: 1,
      line: { color: "#6366f1", width: 2, dash: "dashdot" },
    });
  }
  if (summary?.wakeup != null) {
    shapes.push({
      type: "line",
      xref: "x",
      yref: "paper",
      x0: summary.wakeup,
      x1: summary.wakeup,
      y0: 0,
      y1: 1,
      line: { color: "#eab308", width: 2, dash: "dashdot" },
    });
  }

  // Color each epoch segment by class_id
  const classSegments = buildClassSegments(epochs, hours, epochHours);
  for (const seg of classSegments) {
    shapes.push({
      type: "rect",
      xref: "x",
      yref: "paper",
      x0: seg.x0,
      x1: seg.x1,
      y0: 0,
      y1: 1,
      fillcolor: seg.color + "22",
      line: { width: 0 },
      layer: "below",
    });
  }

  // Acceleration line trace
  const trace: Data = {
    x: hours,
    y: accValues,
    type: "scattergl",
    mode: "lines",
    line: { color: "#2563eb", width: 1 },
    name: "Acceleration (mg)",
    text: times.map((t, i) => `Time: ${t}<br>Acc: ${accValues[i].toFixed(1)} mg<br>Class: ${CLASS_LABELS[epochs[i].class_id] ?? epochs[i].class_id}`),
    hoverinfo: "text" as const,
  };

  // Annotations for sleep onset / wakeup
  const annotations: Partial<Plotly.Annotations>[] = [];
  if (summary?.sleeponset != null) {
    annotations.push({
      x: summary.sleeponset,
      y: 1,
      xref: "x",
      yref: "paper",
      text: `Onset ${decimalHoursToTime(summary.sleeponset)}`,
      showarrow: false,
      font: { size: 10, color: "#6366f1" },
      yanchor: "bottom",
    });
  }
  if (summary?.wakeup != null) {
    annotations.push({
      x: summary.wakeup,
      y: 1,
      xref: "x",
      yref: "paper",
      text: `Wake ${decimalHoursToTime(summary.wakeup)}`,
      showarrow: false,
      font: { size: 10, color: "#eab308" },
      yanchor: "bottom",
    });
  }

  const layout: Partial<Layout> = {
    title: { text: dateLabel, font: { size: 14 } },
    xaxis: {
      title: { text: "Time of Day (hours)" },
      range: [0, 24],
      dtick: 2,
      tickvals: Array.from({ length: 13 }, (_, i) => i * 2),
      ticktext: Array.from({ length: 13 }, (_, i) => `${(i * 2).toString().padStart(2, "0")}:00`),
    },
    yaxis: {
      title: { text: "Acceleration (mg)" },
      rangemode: "tozero",
    },
    shapes,
    annotations,
    margin: { t: 50, r: 20, b: 60, l: 60 },
    hovermode: "closest",
    showlegend: false,
  };

  return (
    <div style={{ height: 400 }}>
      <PlotlyChart
        data={[trace]}
        layout={layout}
        config={{ responsive: true, displayModeBar: true, scrollZoom: true }}
      />
    </div>
  );
}

// Build contiguous segments of the same class_id for background coloring
function buildClassSegments(
  epochs: EpochRow[],
  hours: number[],
  epochHours: number
): { x0: number; x1: number; color: string }[] {
  const segments: { x0: number; x1: number; color: string }[] = [];
  if (epochs.length === 0) return segments;

  let currentClass = epochs[0].class_id;
  let startHour = hours[0];

  for (let i = 1; i <= epochs.length; i++) {
    if (i === epochs.length || epochs[i].class_id !== currentClass) {
      segments.push({
        x0: startHour,
        x1: hours[i - 1] + epochHours,
        color: CLASS_COLORS[currentClass] ?? "#6b7280",
      });
      if (i < epochs.length) {
        currentClass = epochs[i].class_id;
        startHour = hours[i];
      }
    }
  }

  return segments;
}
