import { useMemo } from "react";
import PlotlyChart from "@/components/PlotlyChart";

type SleepHypnogramPoint = {
  date: string;
  sleepOnset: string; // e.g. "23:15"
  wakeUp: string; // e.g. "07:05"
};

type SleepHypnogramProps = {
  data: SleepHypnogramPoint[];
};

// Convert "HH:MM" (optionally "HH:MM:SS") to decimal hours (0–24)
function timeStringToHours(time: string): number | null {
  const trimmed = time.trim();
  if (!trimmed) return null;

  // Support both HH:MM and HH:MM:SS
  const parts = trimmed.split(":").map((p) => Number(p));
  if (parts.some((n) => Number.isNaN(n))) return null;

  const [h = 0, m = 0, s = 0] = parts;
  return h + m / 60 + s / 3600;
}

// Convert decimal hour to minutes from noon (noon = 0, next noon = 1440)
function hoursToMinutesFromNoon(hours: number): number {
  // Shift so noon=0, midnight=720, next-noon=1440
  let shifted = hours - 12;
  if (shifted < 0) shifted += 24;
  return shifted * 60;
}

export function SleepHypnogram({ data }: SleepHypnogramProps) {
  // Pre-compute Plotly-friendly arrays
  const plotData = useMemo(() => {
    if (!data.length) return null;

    type Row = { label: string; baseMin: number; endMin: number };
    const rows: Row[] = [];

    for (const row of data) {
      const onsetHours = timeStringToHours(row.sleepOnset);
      const wakeHours = timeStringToHours(row.wakeUp);

      if (onsetHours === null || wakeHours === null) continue;

      // Handle midnight crossover: if wake < onset, assume wake is next day
      let endHours = wakeHours;
      if (endHours <= onsetHours) {
        endHours += 24;
      }

      const baseMin = hoursToMinutesFromNoon(onsetHours);
      const endMin = hoursToMinutesFromNoon(endHours);

      rows.push({
        label: row.date,
        baseMin,
        endMin,
      });
    }

    if (!rows.length) return null;

    // Build multiple horizontal box plots, one per night.
    // We sample uniformly between baseMin and endMin to approximate the interval.
    const traces = rows
      .map((r) => {
        const start = r.baseMin;
        const end = r.endMin;
        if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
          return null;
        }

        const span = end - start;
        const sampleCount = Math.max(10, Math.min(60, Math.round(span / 30))); // ~every 30 minutes
        const step = span / sampleCount;

        const xs: number[] = [];
        const ys: string[] = [];
        for (let i = 0; i <= sampleCount; i++) {
          xs.push(start + i * step);
          ys.push(r.label);
        }

        return {
          x: xs,
          y: ys,
          type: "box" as const,
          orientation: "h" as const,
          name: r.label,
          marker: {
            color: "#312E81", // dark blue to represent sleep
          },
          line: {
            color: "#312E81",
          },
          showlegend: false,
        };
      })
      .filter((t): t is NonNullable<typeof t> => t !== null);

    if (!traces.length) return null;

    return { traces };
  }, [data]);

  if (!plotData) {
    return (
      <p className="text-sm text-muted-foreground">
        No valid sleep onset / wake-up data available to render hypnogram.
      </p>
    );
  }

  const fixedLightLayout = {
    paper_bgcolor: "#ffffff",
    plot_bgcolor: "#ffffff",
    font: { color: "#111827" },
  };

  const noonAxisTicks = {
    tickmode: "array" as const,
    tickvals: [0, 180, 360, 540, 720, 900, 1080, 1260, 1440],
    ticktext: ["12:00", "15:00", "18:00", "21:00", "00:00", "03:00", "06:00", "09:00", "12:00"],
  };

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="h-[360px]">
        <PlotlyChart
          data={plotData.traces}
          layout={{
            ...fixedLightLayout,
            xaxis: {
              title: { text: "Time of day" },
              range: [0, 1440],
              ...noonAxisTicks,
            },
            yaxis: {
              autorange: "reversed" as const,
              title: { text: "Day" },
            },
            margin: { t: 20, b: 60, l: 100, r: 20 },
            showlegend: false,
          }}
        />
      </div>
    </div>
  );
}

