import { Moon, Activity, Clock, Gauge, HeartPulse } from "lucide-react";
import type { DaySummary } from "@/lib/epochs";

function fmt(v: number | null, decimals = 1, suffix = ""): string {
  if (v == null) return "—";
  return v.toFixed(decimals) + suffix;
}

function fmtTime(decimalHours: number | null): string {
  if (decimalHours == null) return "—";
  const h = Math.floor(decimalHours);
  const m = Math.round((decimalHours - h) * 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export function DaySummaryCards({ summary }: { summary: DaySummary | null }) {
  if (!summary) return null;

  const sleepHours = summary.dur_spt_sleep_min != null ? summary.dur_spt_sleep_min / 60 : null;
  const wearPct = summary.nonwear_perc_day != null ? 100 - summary.nonwear_perc_day : null;

  const cards = [
    {
      icon: Moon,
      label: "Sleep Duration",
      value: fmt(sleepHours, 1, " hrs"),
      color: "text-blue-500",
    },
    {
      icon: HeartPulse,
      label: "WASO",
      value: fmt(summary.waso, 0, " min"),
      color: "text-amber-500",
    },
    {
      icon: Activity,
      label: "MVPA",
      value: fmt(summary.dur_day_mvpa_bts_10_min, 0, " min"),
      color: "text-green-500",
    },
    {
      icon: Clock,
      label: "Wear Time",
      value: wearPct != null ? fmt(wearPct, 1, "%") : "—",
      color: "text-violet-500",
    },
    {
      icon: Gauge,
      label: "Mean Acceleration",
      value: fmt(summary.acc_day_mg, 1, " mg"),
      color: "text-rose-500",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((c) => (
        <div
          key={c.label}
          className="flex items-start gap-3 rounded-lg border bg-card p-3"
        >
          <c.icon className={`h-5 w-5 shrink-0 mt-0.5 ${c.color}`} />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="text-sm font-semibold">{c.value}</p>
          </div>
        </div>
      ))}
      {summary.sleeponset != null && summary.wakeup != null && (
        <>
          <div className="flex items-start gap-3 rounded-lg border bg-card p-3">
            <Moon className="h-5 w-5 shrink-0 mt-0.5 text-indigo-500" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Sleep Onset</p>
              <p className="text-sm font-semibold">{fmtTime(summary.sleeponset)}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border bg-card p-3">
            <Moon className="h-5 w-5 shrink-0 mt-0.5 text-yellow-500" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Wake Up</p>
              <p className="text-sm font-semibold">{fmtTime(summary.wakeup)}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
