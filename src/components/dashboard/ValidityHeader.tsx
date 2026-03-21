import { useMemo } from "react";
import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useData } from "@/context/DataContext";
import { computeValidity, type ValidityStatus } from "@/lib/ggir";

const STATUS_CONFIG: Record<
  ValidityStatus,
  { label: string; variant: "default" | "secondary" | "destructive"; Icon: typeof ShieldCheck }
> = {
  valid: { label: "Valid", variant: "default", Icon: ShieldCheck },
  marginal: { label: "Marginal", variant: "secondary", Icon: ShieldAlert },
  invalid: { label: "Invalid", variant: "destructive", Icon: ShieldX },
};

export function ValidityHeader() {
  const { data, filteredRows } = useData();

  const validity = useMemo(
    () => (data ? computeValidity(filteredRows, data.columns) : null),
    [data, filteredRows]
  );

  if (!data || !validity) return null;

  const { label, variant, Icon } = STATUS_CONFIG[validity.status];

  return (
    <div className="space-y-4">
      {/* Status badge */}
      <div className="flex items-center gap-3">
        <Badge variant={variant} className="gap-1.5 px-3 py-1 text-sm">
          <Icon className="h-4 w-4" />
          {label}
        </Badge>
        {validity.avgValidHours !== null && (
          <span className="text-sm text-muted-foreground">
            Avg. {validity.avgValidHours.toFixed(1)} valid hours / day
          </span>
        )}
      </div>
    </div>
  );
}
