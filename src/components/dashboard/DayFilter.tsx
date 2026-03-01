import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useData } from "@/context/DataContext";
import { formatDate, type DayType } from "@/lib/ggir";

export function DayFilter() {
  const {
    allParticipants,
    selectedParticipant,
    setSelectedParticipant,
    allDates,
    selectedDays,
    toggleDay,
    dayType,
    setDayType,
    accelUnit,
    setAccelUnit,
  } = useData();

  const showParticipantSelector = allParticipants.length > 1;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex flex-wrap items-end gap-6">
        {/* Participant selector (only shown for multi-participant files) */}
        {showParticipantSelector && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Participant</label>
            <Select
              value={selectedParticipant ?? "__all__"}
              onValueChange={(v) =>
                setSelectedParticipant(v === "__all__" ? null : v)
              }
            >
              <SelectTrigger className="w-[240px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Participants</SelectItem>
                {allParticipants.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Day checkboxes */}
        <div className="flex-1 min-w-[200px]">
          <p className="mb-2 text-sm font-medium">Include Days</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {allDates.map((rawDate) => (
              <label
                key={rawDate}
                className="flex items-center gap-1.5 text-sm cursor-pointer"
              >
                <Checkbox
                  checked={selectedDays.has(rawDate)}
                  onCheckedChange={() => toggleDay(rawDate)}
                />
                <span className="whitespace-nowrap">{formatDate(rawDate)}</span>
              </label>
            ))}
            {allDates.length === 0 && (
              <span className="text-xs text-muted-foreground">
                No calendar_date column found
              </span>
            )}
          </div>
        </div>

        {/* Weekend / Weekday toggle */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Day Type</label>
          <Select value={dayType} onValueChange={(v) => setDayType(v as DayType)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Days</SelectItem>
              <SelectItem value="weekday">Weekdays</SelectItem>
              <SelectItem value="weekend">Weekends</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Unit converter */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Acceleration Unit</label>
          <div className="flex items-center gap-2">
            <span className={`text-xs ${accelUnit === "mg" ? "font-semibold" : "text-muted-foreground"}`}>
              mg
            </span>
            <Switch
              checked={accelUnit === "ms2"}
              onCheckedChange={(checked) => setAccelUnit(checked ? "ms2" : "mg")}
            />
            <span className={`text-xs ${accelUnit === "ms2" ? "font-semibold" : "text-muted-foreground"}`}>
              m/s&sup2;
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
