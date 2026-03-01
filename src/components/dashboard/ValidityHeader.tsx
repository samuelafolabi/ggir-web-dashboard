import { useMemo } from "react";
import { ShieldCheck, ShieldAlert, ShieldX, User, Cpu, CalendarDays, Clock, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useData } from "@/context/DataContext";
import {
  GGIR_COLUMNS,
  computeValidity,
  computeAverageWearTime,
  getDeviceId,
  getParticipantColumn,
  toString,
  formatDate,
  type ValidityStatus,
} from "@/lib/ggir";

const STATUS_CONFIG: Record<
  ValidityStatus,
  { label: string; variant: "default" | "secondary" | "destructive"; Icon: typeof ShieldCheck }
> = {
  valid: { label: "Valid", variant: "default", Icon: ShieldCheck },
  marginal: { label: "Marginal", variant: "secondary", Icon: ShieldAlert },
  invalid: { label: "Invalid", variant: "destructive", Icon: ShieldX },
};

export function ValidityHeader() {
  const { data, filteredRows, selectedParticipant } = useData();

  const validity = useMemo(
    () => (data ? computeValidity(filteredRows, data.columns) : null),
    [data, filteredRows]
  );

  const avgWearTime = useMemo(
    () => (data ? computeAverageWearTime(filteredRows, data.columns) : null),
    [data, filteredRows]
  );

  const deviceId = useMemo(
    () => (data ? getDeviceId(data.rows, data.columns) : null),
    [data]
  );

  // Determine participant label: selected participant, filename, or device_sn
  const participantLabel = useMemo(() => {
    if (!data) return null;
    if (selectedParticipant) return selectedParticipant;
    const pCol = getParticipantColumn(data.columns);
    if (pCol) {
      const val = data.rows[0]?.[pCol];
      return val != null ? toString(val) : null;
    }
    return null;
  }, [data, selectedParticipant]);

  const recordingInfo = useMemo(() => {
    if (!data) return { days: 0, range: "" };
    const rawDates = filteredRows
      .map((r) => toString(r[GGIR_COLUMNS.calendarDate]))
      .filter(Boolean);
    const uniqueDates = [...new Set(rawDates)];
    const days = uniqueDates.length;

    // Build a date range string
    if (uniqueDates.length >= 2) {
      const first = formatDate(uniqueDates[0]);
      const last = formatDate(uniqueDates[uniqueDates.length - 1]);
      return { days, range: `${first} — ${last}` };
    }
    return { days, range: uniqueDates.length === 1 ? formatDate(uniqueDates[0]) : "" };
  }, [data, filteredRows]);

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

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-start gap-3 p-4">
            <Cpu className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Device ID</p>
              <p className="text-sm font-semibold wrap-break-word">
                {deviceId ?? "N/A"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start gap-3 p-4">
            <User className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Participant</p>
              <p className="text-sm font-semibold wrap-break-word">
                {participantLabel ?? "N/A"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start gap-3 p-4">
            <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Recording</p>
              <p className="text-sm font-semibold">
                {recordingInfo.days} Day{recordingInfo.days !== 1 ? "s" : ""}
              </p>
              {recordingInfo.range && (
                <p className="text-xs text-muted-foreground">{recordingInfo.range}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start gap-3 p-4">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Avg. Wear Time</p>
              <p className="text-sm font-semibold">
                {avgWearTime !== null ? `${avgWearTime.toFixed(1)} hrs/day` : "N/A"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start gap-3 p-4">
            <Activity className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Calibration Error</p>
              <p className="text-sm font-semibold">
                {validity.avgCalibError !== null ? (
                  <>
                    {validity.avgCalibError.toFixed(4)}
                    {validity.avgCalibError <= 0.01 ? (
                      <span className="ml-1.5 text-xs font-normal text-green-600 dark:text-green-400">Pass</span>
                    ) : (
                      <span className="ml-1.5 text-xs font-normal text-red-600 dark:text-red-400">Fail</span>
                    )}
                  </>
                ) : (
                  "N/A"
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
