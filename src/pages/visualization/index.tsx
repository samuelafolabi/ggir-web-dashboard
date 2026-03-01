import { useState, useMemo } from "react";
import { useRouter } from "next/router";
import { Info, ChevronDown, ChevronUp, FileText, Layers, Columns3, Hash } from "lucide-react";
import MainLayout from "@/components/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useData } from "@/context/DataContext";
import { detectAvailableModules } from "@/lib/ggir";

import { ValidityHeader } from "@/components/dashboard/ValidityHeader";
import { DayFilter } from "@/components/dashboard/DayFilter";
import { ParticipantTimeline } from "@/components/dashboard/ParticipantTimeline";
import { DataQualityTab } from "@/components/dashboard/DataQualityTab";
import { SleepAnalysisTab } from "@/components/dashboard/SleepAnalysisTab";
import { PhysicalActivityTab } from "@/components/dashboard/PhysicalActivityTab";

export default function Visualization() {
  const { data } = useData();
  const router = useRouter();
  const [metaExpanded, setMetaExpanded] = useState(false);

  // Determine which tabs are available based on column presence
  const modules = useMemo(
    () => (data ? detectAvailableModules(data.columns) : null),
    [data]
  );

  // Determine the first available tab for default selection
  const defaultTab = useMemo(() => {
    if (!modules) return "data-quality";
    if (modules.dataQuality) return "data-quality";
    if (modules.sleep) return "sleep";
    if (modules.physicalActivity) return "physical-activity";
    return "data-quality";
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

  const { metadata } = data;
  const kvEntries = Object.entries(metadata.keyValueMetadata);
  const hasKvMeta = kvEntries.length > 0;

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <MainLayout>
      <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
        {/* ── Page heading ───────────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            GGIR Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {metadata.fileName}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {metadata.numRows.toLocaleString()} rows · {metadata.numColumns} columns
            {metadata.fileSizeBytes != null && (
              <> · {formatFileSize(metadata.fileSizeBytes)}</>
            )}
          </p>
        </div>

        {/* ── Validity header (traffic-light + stats) ────────── */}
        <ValidityHeader />

        {/* ── Filters ────────────────────────────────────────── */}
        <DayFilter />

        {/* ── Participant / Recording Timeline ───────────────── */}
        <ParticipantTimeline />

        {/* ── Collapsible file metadata ──────────────────────── */}
        <div className="rounded-lg border bg-card">
          <button
            onClick={() => setMetaExpanded((v) => !v)}
            className="flex w-full items-center justify-between p-4 text-sm font-medium hover:bg-accent/50 transition-colors rounded-lg"
          >
            <span className="flex items-center gap-2">
              <Info className="h-4 w-4 text-muted-foreground" />
              File Metadata
            </span>
            {metaExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {metaExpanded && (
            <div className="border-t p-5 space-y-4">
              {/* Summary stats */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="flex items-start gap-2.5 rounded-md border bg-muted/40 p-3">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">File Name</p>
                    <p className="text-sm font-medium truncate max-w-[180px]" title={metadata.fileName}>
                      {metadata.fileName}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 rounded-md border bg-muted/40 p-3">
                  <Hash className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Total Rows</p>
                    <p className="text-sm font-medium">{metadata.numRows.toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 rounded-md border bg-muted/40 p-3">
                  <Columns3 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Columns</p>
                    <p className="text-sm font-medium">{metadata.numColumns}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 rounded-md border bg-muted/40 p-3">
                  <Layers className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Row Groups</p>
                    <p className="text-sm font-medium">{metadata.numRowGroups}</p>
                  </div>
                </div>
              </div>

              {metadata.createdBy && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Created by:</span>{" "}
                  {metadata.createdBy}
                </p>
              )}

              {/* Key-value metadata */}
              {hasKvMeta && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Key-Value Metadata</h3>
                  <div className="rounded-md border overflow-auto max-h-[200px]">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Key</th>
                          <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kvEntries.map(([key, value]) => (
                          <tr key={key} className="border-b last:border-0">
                            <td className="px-3 py-1.5 font-mono text-xs whitespace-nowrap">{key}</td>
                            <td className="px-3 py-1.5 text-xs break-all max-w-[400px]">{value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Column schema */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium">
                  Column Schema ({metadata.schema.length} fields)
                </h3>
                <div className="rounded-md border overflow-auto max-h-[260px]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">#</th>
                        <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Column</th>
                        <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metadata.schema.map((field, i) => (
                        <tr key={field.name} className="border-b last:border-0">
                          <td className="px-3 py-1.5 text-xs text-muted-foreground">{i + 1}</td>
                          <td className="px-3 py-1.5 font-mono text-xs">{field.name}</td>
                          <td className="px-3 py-1.5 text-xs text-muted-foreground">{field.type}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Analysis Tabs ──────────────────────────────────── */}
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="w-full justify-start">
            <TabsTrigger
              value="data-quality"
              disabled={!modules?.dataQuality}
              title={!modules?.dataQuality ? "No data quality columns found in this file" : undefined}
            >
              Data Quality
            </TabsTrigger>
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

          <TabsContent value="data-quality" className="mt-6">
            <DataQualityTab />
          </TabsContent>

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
