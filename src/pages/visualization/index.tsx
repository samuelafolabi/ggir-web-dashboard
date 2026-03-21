import { useMemo } from "react";
import { useRouter } from "next/router";
import MainLayout from "@/components/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useData } from "@/context/DataContext";
import { detectAvailableModules, getAllParticipants, getDeviceId, computeValidity } from "@/lib/ggir";

import { ValidityHeader } from "@/components/dashboard/ValidityHeader";
import { DayFilter } from "@/components/dashboard/DayFilter";
import { ParticipantTimeline } from "@/components/dashboard/ParticipantTimeline";
import { SleepAnalysisTab } from "@/components/dashboard/SleepAnalysisTab";
import { PhysicalActivityTab } from "@/components/dashboard/PhysicalActivityTab";

export default function Visualization() {
  const { data } = useData();
  const router = useRouter();

  // Determine which tabs are available based on column presence
  const modules = useMemo(
    () => (data ? detectAvailableModules(data.columns) : null),
    [data]
  );

  const participantLabel = useMemo(() => {
    if (!data) return "GGIR Dashboard";
    const participants = getAllParticipants(data.rows, data.columns);
    if (participants.length === 0) return "GGIR Dashboard";
    if (participants.length === 1) return `Participant ${participants[0]}`;
    return `${participants.length} Participants`;
  }, [data]);

  const deviceId = useMemo(
    () => (data ? getDeviceId(data.rows, data.columns) : null),
    [data]
  );

  const calibError = useMemo(() => {
    if (!data) return null;
    const v = computeValidity(data.rows, data.columns);
    return v.avgCalibError;
  }, [data]);

  // Determine the first available tab for default selection
  const defaultTab = useMemo(() => {
    if (!modules) return "sleep";
    if (modules.sleep) return "sleep";
    if (modules.physicalActivity) return "physical-activity";
    return "sleep";
  }, [modules]);

  // No data loaded — redirect prompt
  if (!data) {
    return (
      <MainLayout>
        <div className="mx-auto max-w-5xl px-4 py-24 text-center">
          <h2 className="text-xl font-semibold">No data loaded</h2>
          <p className="mt-2 text-muted-foreground">
            Please upload a parquet file first.
          </p>
          <button
            onClick={() => router.push("/")}
            className="mt-6 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Go to Upload
          </button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
        {/* ── Page heading ───────────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {participantLabel}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
            {deviceId && (
              <span>Device: {deviceId}</span>
            )}
            {deviceId && calibError !== null && (
              <span className="text-muted-foreground/50">·</span>
            )}
            {calibError !== null && (
              <span>
                Calibration Error: {calibError.toFixed(4)}
                {calibError <= 0.01 ? (
                  <span className="ml-1 text-xs text-green-600 dark:text-green-400">Pass</span>
                ) : (
                  <span className="ml-1 text-xs text-red-600 dark:text-red-400">Fail</span>
                )}
              </span>
            )}
          </p>
        </div>

        {/* ── Validity header (traffic-light + stats) ────────── */}
        <ValidityHeader />

        {/* ── Filters ────────────────────────────────────────── */}
        <DayFilter />

        {/* ── Recording Timeline ─────────────────────────────── */}
        <div className="mb-8">
          <ParticipantTimeline />
        </div>

        {/* ── Analysis Tabs ──────────────────────────────────── */}
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="w-full justify-start">
            <TabsTrigger
              value="sleep"
              disabled={!modules?.sleep}
              title={!modules?.sleep ? "No sleep columns found in this file" : undefined}
            >
              Sleep
            </TabsTrigger>
            <TabsTrigger
              value="physical-activity"
              disabled={!modules?.physicalActivity}
              title={!modules?.physicalActivity ? "No physical activity columns found in this file" : undefined}
            >
              Physical Activity
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sleep" className="mt-6">
            <SleepAnalysisTab />
          </TabsContent>

          <TabsContent value="physical-activity" className="mt-6">
            <PhysicalActivityTab />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
