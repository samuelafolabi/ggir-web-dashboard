import { CLASS_LABELS, CLASS_COLORS } from "@/lib/epochs";

export function ClassLegend({ classIds }: { classIds: Set<number> }) {
  const entries = Array.from(classIds)
    .sort((a, b) => a - b)
    .map((id) => ({
      id,
      label: CLASS_LABELS[id] ?? `Class ${id}`,
      color: CLASS_COLORS[id] ?? "#6b7280",
    }));

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
      {entries.map((e) => (
        <span key={e.id} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-sm shrink-0"
            style={{ backgroundColor: e.color }}
          />
          {e.label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-sm shrink-0 border border-dashed border-red-400 bg-red-100/50" />
        Invalid / Non-wear
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-sm shrink-0 bg-blue-200/40 border border-blue-400" />
        Sleep Period Time
      </span>
    </div>
  );
}
