import PlotlyChart from "@/components/PlotlyChart";
import type { EpochRow } from "@/lib/epochs";
import type { Data, Layout } from "plotly.js";

function epochToHourFraction(timenum: number): number {
  const d = new Date(timenum * 1000);
  return d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
}

type Props = {
  epochs: EpochRow[];
  hasAnglez: boolean;
  hasLux: boolean;
  hasTemperature: boolean;
};

export function SecondarySignals({ epochs, hasAnglez, hasLux, hasTemperature }: Props) {
  if (!hasAnglez && !hasLux && !hasTemperature) return null;
  if (epochs.length === 0) return null;

  const hours = epochs.map((e) => epochToHourFraction(e.timenum));
  const traces: Data[] = [];

  if (hasAnglez) {
    traces.push({
      x: hours,
      y: epochs.map((e) => e.anglez ?? null),
      type: "scattergl",
      mode: "lines",
      name: "Angle Z (°)",
      line: { color: "#8b5cf6", width: 1 },
      yaxis: "y",
    });
  }

  if (hasLux) {
    traces.push({
      x: hours,
      y: epochs.map((e) => e.lux ?? null),
      type: "scattergl",
      mode: "lines",
      name: "Light (lux)",
      line: { color: "#f59e0b", width: 1 },
      yaxis: hasAnglez ? "y2" : "y",
    });
  }

  if (hasTemperature) {
    const axisIdx = [hasAnglez, hasLux].filter(Boolean).length;
    const yKey = axisIdx === 0 ? "y" : axisIdx === 1 ? "y2" : "y3";
    traces.push({
      x: hours,
      y: epochs.map((e) => e.temperature ?? null),
      type: "scattergl",
      mode: "lines",
      name: "Temperature (°C)",
      line: { color: "#ef4444", width: 1 },
      yaxis: yKey,
    });
  }

  const yAxes: Record<string, Partial<Layout["yaxis"]>> = {};
  const activeSignals = [hasAnglez && "Angle Z (°)", hasLux && "Light (lux)", hasTemperature && "Temp (°C)"].filter(Boolean) as string[];

  if (activeSignals.length >= 1) {
    yAxes.yaxis = {
      title: { text: activeSignals[0] },
      side: "left",
    };
  }
  if (activeSignals.length >= 2) {
    yAxes.yaxis2 = {
      title: { text: activeSignals[1] },
      overlaying: "y",
      side: "right",
    };
  }
  if (activeSignals.length >= 3) {
    yAxes.yaxis3 = {
      title: { text: activeSignals[2] },
      overlaying: "y",
      side: "right",
      anchor: "free",
      position: 0.95,
    };
  }

  const layout: Partial<Layout> = {
    title: { text: "Secondary Signals", font: { size: 13 } },
    xaxis: {
      title: { text: "Time of Day (hours)" },
      range: [0, 24],
      dtick: 2,
      tickvals: Array.from({ length: 13 }, (_, i) => i * 2),
      ticktext: Array.from({ length: 13 }, (_, i) => `${(i * 2).toString().padStart(2, "0")}:00`),
    },
    ...yAxes,
    margin: { t: 40, r: activeSignals.length > 1 ? 80 : 20, b: 50, l: 60 },
    showlegend: true,
    legend: { orientation: "h", y: 1.12 },
    hovermode: "x unified",
  };

  return (
    <div style={{ height: 300 }}>
      <PlotlyChart
        data={traces}
        layout={layout}
        config={{ responsive: true, displayModeBar: true, scrollZoom: true }}
      />
    </div>
  );
}
