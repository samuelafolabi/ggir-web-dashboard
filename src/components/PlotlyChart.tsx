import dynamic from "next/dynamic";
import type { PlotParams } from "react-plotly.js";

const Plot = dynamic(() => import("react-plotly.js"), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 items-center justify-center text-muted-foreground">
      Loading chart…
    </div>
  ),
});

type PlotlyChartProps = Partial<PlotParams> &
  Pick<PlotParams, "data">;

export default function PlotlyChart({
  data,
  layout,
  config,
  style,
  ...rest
}: PlotlyChartProps) {
  return (
    <Plot
      data={data}
      layout={{
        autosize: true,
        margin: { t: 40, r: 20, b: 50, l: 60 },
        ...layout,
      }}
      config={{
        responsive: true,
        displayModeBar: true,
        ...config,
      }}
      useResizeHandler={true}
      style={{ width: "100%", height: "100%", ...style }}
      {...rest}
    />
  );
}
