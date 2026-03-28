import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import { Loader2 } from "lucide-react";
import MainLayout from "@/components/MainLayout";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useData } from "@/context/DataContext";
import {
  hasEpochsColumn,
  getEpochParticipants,
  getParticipantDays,
  getDaySummary,
  getAllDaySummaries,
  getEpochs,
  getMultiDayEpochSummary,
} from "@/lib/epochs";
import type { EpochRow, DaySummary, ParticipantDay } from "@/lib/epochs";
import { formatDate } from "@/lib/ggir";

import { ActivityTimeline } from "@/components/epochs/ActivityTimeline";
import { MultiDayStack } from "@/components/epochs/MultiDayStack";
import { DaySummaryCards } from "@/components/epochs/DaySummaryCards";
import { SecondarySignals } from "@/components/epochs/SecondarySignals";
import { ClassLegend } from "@/components/epochs/ClassLegend";
import { ClassDonutChart } from "@/components/epochs/ClassDonutChart";
import { ClassByHourChart } from "@/components/epochs/ClassByHourChart";
import { AccHistogram } from "@/components/epochs/AccHistogram";
import { DailyTrendsChart } from "@/components/epochs/DailyTrendsChart";
import { HourlyProfileChart } from "@/components/epochs/HourlyProfileChart";
import { ActivityHeatmap } from "@/components/epochs/ActivityHeatmap";
import { SleepVariabilityChart } from "@/components/epochs/SleepVariabilityChart";
import { MvpaAccumulationChart } from "@/components/epochs/MvpaAccumulationChart";
import { NonWearTimeline } from "@/components/epochs/NonWearTimeline";
import { AccByClassBoxPlot } from "@/components/epochs/AccByClassBoxPlot";

type MultiDayData = {
  calendar_date: string;
  weekday: string;
  epochs: { timenum: number; class_id: number; spt: boolean; invalid: boolean }[];
}[];

type ClassDistributionView = "both" | "day" | "night";

function formatDateWithoutWeekday(raw: string): string {
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  const fallback = formatDate(raw);
  if (!fallback) return raw;
  return fallback.replace(/^[A-Za-z]{3},\s*/, "");
}

export default function EpochExplorer() {
  const { data } = useData();
  const router = useRouter();

  // State
  const [hasEpochs, setHasEpochs] = useState<boolean | null>(null);
  const [participants, setParticipants] = useState<string[]>([]);
  const [selectedParticipant, setSelectedParticipant] = useState<string>("");
  const [days, setDays] = useState<ParticipantDay[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [epochs, setEpochs] = useState<EpochRow[]>([]);
  const [summary, setSummary] = useState<DaySummary | null>(null);
  const [multiDayData, setMultiDayData] = useState<MultiDayData>([]);
  const [allSummaries, setAllSummaries] = useState<DaySummary[]>([]);
  const [optionalFields, setOptionalFields] = useState({ hasAnglez: false, hasLux: false, hasTemperature: false });
  const [loadingCheck, setLoadingCheck] = useState(true);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [loadingDays, setLoadingDays] = useState(false);
  const [loadingEpochs, setLoadingEpochs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [classDistributionView, setClassDistributionView] = useState<ClassDistributionView>("both");

  const fileName = data?.metadata.fileName ?? "";

  // Check if file has epochs column
  useEffect(() => {
    if (!fileName) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoadingCheck(false);
      return;
    }
    setLoadingCheck(true);
    hasEpochsColumn(fileName)
      .then((has) => {
        setHasEpochs(has);
        if (has) {
          setLoadingParticipants(true);
          return getEpochParticipants(fileName);
        }
        return [];
      })
      .then((p) => {
        if (p && p.length > 0) {
          setParticipants(p);
          setSelectedParticipant(p[0]);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => {
        setLoadingCheck(false);
        setLoadingParticipants(false);
      });
  }, [fileName]);

  // Load days when participant changes
  useEffect(() => {
    if (!fileName || !selectedParticipant) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingDays(true);
    setDays([]);
    setSelectedDate("");
    setEpochs([]);
    setSummary(null);

    Promise.all([
      getParticipantDays(fileName, selectedParticipant),
      getMultiDayEpochSummary(fileName, selectedParticipant).catch(() => [] as MultiDayData),
      getAllDaySummaries(fileName, selectedParticipant).catch(() => [] as DaySummary[]),
    ])
      .then(([d, md, sums]) => {
        setDays(d);
        setMultiDayData(md);
        setAllSummaries(sums);
        if (d.length > 0) {
          setSelectedDate(d[0].calendar_date);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => {
        setLoadingDays(false);
      });
  }, [fileName, selectedParticipant]);

  // Load epochs when date changes
  useEffect(() => {
    if (!fileName || !selectedParticipant || !selectedDate) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingEpochs(true);
    setError(null);

    Promise.all([
      getEpochs(fileName, selectedParticipant, selectedDate),
      getDaySummary(fileName, selectedParticipant, selectedDate),
    ])
      .then(([epochData, summaryData]) => {
        setEpochs(epochData.epochs);
        setOptionalFields({
          hasAnglez: epochData.hasAnglez,
          hasLux: epochData.hasLux,
          hasTemperature: epochData.hasTemperature,
        });
        setSummary(summaryData);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoadingEpochs(false));
  }, [fileName, selectedParticipant, selectedDate]);

  const handleDayClick = useCallback((calendarDate: string) => {
    setSelectedDate(calendarDate);
  }, []);

  const classIdsInView = useMemo(() => {
    const ids = new Set<number>();
    for (const e of epochs) ids.add(e.class_id);
    return ids;
  }, [epochs]);

  const dateLabel = useMemo(() => {
    const day = days.find((d) => d.calendar_date === selectedDate);
    if (!day) return selectedDate;
    const formatted = formatDateWithoutWeekday(day.calendar_date);
    return day.weekday ? `${day.weekday}, ${formatted}` : formatted;
  }, [days, selectedDate]);

  const filteredClassEpochs = useMemo(() => {
    const validEpochs = epochs.filter((e) => !e.invalid);
    if (classDistributionView === "day") return validEpochs.filter((e) => !e.spt);
    if (classDistributionView === "night") return validEpochs.filter((e) => e.spt);
    return validEpochs;
  }, [epochs, classDistributionView]);

  const inferredEpochSeconds = useMemo(() => {
    if (epochs.length < 2) return 5;
    const deltas: number[] = [];
    for (let i = 1; i < epochs.length; i++) {
      const d = epochs[i].timenum - epochs[i - 1].timenum;
      if (Number.isFinite(d) && d > 0) deltas.push(d);
    }
    if (deltas.length === 0) return 5;
    deltas.sort((a, b) => a - b);
    return deltas[Math.floor(deltas.length / 2)];
  }, [epochs]);

  const filteredClassMinutes = useMemo(
    () => (filteredClassEpochs.length * inferredEpochSeconds) / 60,
    [filteredClassEpochs, inferredEpochSeconds]
  );

  // No data loaded
  if (!data) {
    return (
      <MainLayout>
        <div className="mx-auto max-w-5xl px-4 py-24 text-center">
          <h2 className="text-xl font-semibold">No data loaded</h2>
          <p className="mt-2 text-muted-foreground">
            Please upload a parquet file first.
          </p>
          <Button onClick={() => router.push("/")} className="mt-6">
            Go to Upload
          </Button>
        </div>
      </MainLayout>
    );
  }

  // Checking for epochs column
  if (loadingCheck) {
    return (
      <MainLayout>
        <div className="mx-auto max-w-7xl px-4 py-16 flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Checking for epoch data…</p>
        </div>
      </MainLayout>
    );
  }

  // No epochs column
  if (hasEpochs === false) {
    return (
      <MainLayout>
        <div className="mx-auto max-w-5xl px-4 py-24 text-center">
          <h2 className="text-xl font-semibold">No Epoch Data Found</h2>
          <p className="mt-2 text-muted-foreground">
            The uploaded parquet file does not contain a nested <code className="font-mono text-sm bg-muted px-1 py-0.5 rounded">epochs</code> column.
            This page requires epoch-level data (LIST&lt;STRUCT&gt;) from GGIR output.
          </p>
          <Button onClick={() => router.push("/visualization")} className="mt-6">
            Back to Dashboard
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
        {/* Header & Selectors */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Epoch Explorer
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Epoch-level accelerometer time series — {data.metadata.fileName}
            </p>
          </div>

          <div className="flex items-end gap-3">
            {participants.length > 1 && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Participant
                </label>
                <Select value={selectedParticipant} onValueChange={setSelectedParticipant}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select participant" />
                  </SelectTrigger>
                  <SelectContent>
                    {participants.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Day
              </label>
              {loadingDays ? (
                <div className="flex h-9 w-[220px] items-center justify-center rounded-md border bg-muted">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : (
                <Select value={selectedDate} onValueChange={setSelectedDate}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Select day" />
                  </SelectTrigger>
                  <SelectContent>
                    {days.map((d) => (
                      <SelectItem key={d.calendar_date} value={d.calendar_date}>
                        {d.weekday ? `${d.weekday} — ` : ""}
                        {formatDateWithoutWeekday(d.calendar_date) || d.calendar_date}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Daily Summary Cards */}
        {summary && <DaySummaryCards summary={summary} />}

        {/* 24-hour Activity Timeline */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">24-Hour Activity Timeline</h2>
          {loadingEpochs ? (
            <div className="flex h-64 items-center justify-center rounded-lg border bg-card">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Loading {selectedDate ? "epoch data" : ""}…</span>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <ActivityTimeline epochs={epochs} summary={summary} dateLabel={dateLabel} />
              <ClassLegend classIds={classIdsInView} />
            </div>
          )}
        </div>

        {/* Secondary Signals */}
        {!loadingEpochs && (optionalFields.hasAnglez || optionalFields.hasLux || optionalFields.hasTemperature) && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Secondary Signals</h2>
            <p className="text-sm text-muted-foreground">
              This view uses multiple y-axes (left and right) for different units.
              Compare timing and shape across signals; compare absolute magnitudes only within the same axis.
            </p>
            <div className="rounded-lg border bg-card p-4">
              <SecondarySignals
                epochs={epochs}
                hasAnglez={optionalFields.hasAnglez}
                hasLux={optionalFields.hasLux}
                hasTemperature={optionalFields.hasTemperature}
              />
            </div>
          </div>
        )}

        {/* Activity Class Distribution & Acceleration Stats */}
        {!loadingEpochs && epochs.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Activity & Acceleration Analysis</h2>
            <div className="rounded-lg border bg-card p-4">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Tabs
                  value={classDistributionView}
                  onValueChange={(value) => setClassDistributionView(value as ClassDistributionView)}
                >
                  <TabsList>
                    <TabsTrigger value="both">Both</TabsTrigger>
                    <TabsTrigger value="day">Daytime</TabsTrigger>
                    <TabsTrigger value="night">Night-time</TabsTrigger>
                  </TabsList>
                </Tabs>
                <p className="text-xs text-muted-foreground">
                  View: {classDistributionView === "both" ? "both periods" : classDistributionView === "day" ? "daytime only" : "night-time only"} | {filteredClassEpochs.length.toLocaleString()} valid epochs ({filteredClassMinutes.toFixed(1)} min)
                </p>
              </div>
              {filteredClassEpochs.length > 0 ? (
                <ClassDonutChart epochs={filteredClassEpochs} epochSeconds={inferredEpochSeconds} />
              ) : (
                <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
                  No valid epochs available for this selection.
                </div>
              )}
            </div>
            <div className="space-y-2">
              <h3 className="text-base font-medium">Acceleration Distribution (Log-Scale View)</h3>
              <p className="text-sm text-muted-foreground">
                Binned in equal log-x intervals and plotted as a line curve; y-scale auto-switches between linear and log based on count range.
              </p>
              <div className="rounded-lg border bg-card p-4">
                <AccHistogram epochs={epochs} xScale="log" />
              </div>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <ClassByHourChart epochs={epochs} />
            </div>
            <div className="rounded-lg border bg-card p-4">
              <AccByClassBoxPlot epochs={epochs} />
            </div>
          </div>
        )}

        {/* MVPA Accumulation */}
        {!loadingEpochs && epochs.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">MVPA Accumulation</h2>
            <div className="rounded-lg border bg-card p-4">
              <MvpaAccumulationChart epochs={epochs} epochSeconds={inferredEpochSeconds} />
            </div>
          </div>
        )}

        {/* Multi-Day Stacked View */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Multi-Day Overview</h2>
          <p className="text-sm text-muted-foreground">
            Full recording at a glance — each row shows one day color-coded by behavioral class.
          </p>
          {loadingDays ? (
            <div className="flex h-32 items-center justify-center rounded-lg border bg-card">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <MultiDayStack days={multiDayData} onDayClick={handleDayClick} />
              <ClassLegend
                classIds={new Set(multiDayData.flatMap((d) => d.epochs.map((e) => e.class_id)))}
              />
            </div>
          )}
        </div>

        {/* Activity Heatmap */}
        {!loadingDays && multiDayData.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Activity Heatmap</h2>
            <div className="rounded-lg border bg-card p-4">
              <ActivityHeatmap days={multiDayData} />
            </div>
          </div>
        )}

        {/* Hourly Average Profile */}
        {!loadingEpochs && epochs.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Hourly Average Profile</h2>
            <p className="text-sm text-muted-foreground">
              Mean acceleration by hour of day — reveals circadian activity pattern.
            </p>
            <div className="rounded-lg border bg-card p-4">
              <HourlyProfileChart epochs={epochs} />
            </div>
          </div>
        )}

        {/* Daily Summary Trends */}
        {allSummaries.length >= 2 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Daily Summary Trends</h2>
            <p className="text-sm text-muted-foreground">
              Metrics are plotted on separate y-axes due to different units (mg, minutes/hours, and %).
              Use this chart for day-to-day trend direction rather than direct vertical comparisons between lines.
            </p>
            <div className="rounded-lg border bg-card p-4">
              <DailyTrendsChart summaries={allSummaries} />
            </div>
          </div>
        )}

        {/* Sleep Variability */}
        {allSummaries.length >= 2 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Sleep Variability</h2>
            <div className="rounded-lg border bg-card p-4">
              <SleepVariabilityChart summaries={allSummaries} />
            </div>
          </div>
        )}

        {/* Non-Wear Timeline */}
        {!loadingDays && multiDayData.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Non-Wear / Data Quality</h2>
            <div className="rounded-lg border bg-card p-4">
              <NonWearTimeline days={multiDayData} />
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
