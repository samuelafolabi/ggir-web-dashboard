import PlotlyChart from "@/components/PlotlyChart";
import type { DaySummary } from "@/lib/epochs";
import { formatDate } from "@/lib/ggir";
import type { Data, Layout } from "plotly.js";

type Props = { summaries: DaySummary[] };

export function DailyTrendsChart({ summaries }: Props) {
  if (summaries.length < 2) return null;

  const dates = summaries.map((s) => formatDate(s.calendar_date) || s.calendar_date);

  const metrics: { key: keyof DaySummary; label: string; color: string; yaxis: string; unit: string; transform?: (v: number) => number }[] = [
    { key: "acc_day_mg", label: "Mean Acc (mg)", color: "#2563eb", yaxis: "y", unit: "mg" },
    { key: "dur_day_mvpa_bts_10_min", label: "MVPA (min)", color: "#16a34a", yaxis: "y2", unit: "min" },
    { key: "dur_spt_sleep_min", label: "Sleep (hrs)", color: "#7c3aed", yaxis: "y2", unit: "hrs", transform: (v) => v / 60 },
    { key: "waso", label: "WASO (min)", color: "#ea580c", yaxis: "y2", unit: "min" },
    { key: "nonwear_perc_day", label: "Non-wear (%)", color: "#dc2626", yaxis: "y3", unit: "%" },
  ];

  const traces: Data[] = metrics
    .filter((m) => summaries.some((s) => s[m.key] != null))
    .map((m) => ({
      x: dates,
      y: summaries.map((s) => {
        const v = s[m.key] as number | null;
        return v != null && m.transform ? m.transform(v) : v;
      }),
      type: "scatter" as const,
      mode: "lines+markers" as const,
      name: m.label,
      line: { color: m.color, width: 2 },
      marker: { size: 6 },
      yaxis: m.yaxis,
      hovertemplate: `%{x}<br>${m.label}: %{y:.1f} ${m.unit}<extra></extra>`,
    }));

  const layout: Partial<Layout> = {
    title: { text: "Daily Summary Trends", font: { size: 14 } },
    xaxis: { title: { text: "Day" } },
    yaxis: { title: { text: "Acceleration (mg)" }, side: "left" },
    yaxis2: { title: { text: "Minutes / Hours" }, overlaying: "y", side: "right" },
    yaxis3: { title: { text: "%" }, overlaying: "y", side: "right", anchor: "free", position: 0.95, showgrid: false },
    margin: { t: 40, r: 80, b: 60, l: 60 },
    legend: { orientation: "h", y: -0.3, font: { size: 10 } },
    hovermode: "x unified",
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
