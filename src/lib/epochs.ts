/**
 * DuckDB query helpers for epoch-level data from nested Parquet files.
 * The parquet contains day-level rows with a nested `epochs` column of
 * type LIST<STRUCT>.
 */

import { initDuckDB } from "./duckdb";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EpochRow = {
  timenum: number;
  acc: number;
  class_id: number;
  spt: boolean;
  invalid: boolean;
  window: number;
  anglez?: number;
  lux?: number;
  temperature?: number;
};

export type DaySummary = {
  id: string;
  calendar_date: string;
  weekday: string;
  sleeponset: number | null;
  wakeup: number | null;
  dur_spt_sleep_min: number | null;
  dur_spt_min: number | null;
  waso: number | null;
  dur_day_mvpa_bts_10_min: number | null;
  nonwear_perc_day: number | null;
  acc_day_mg: number | null;
};

export type ParticipantDay = {
  id: string;
  calendar_date: string;
  weekday: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function arrowToPlainRows(result: {
  schema: { fields: { name: string }[] };
  numRows: number;
  getChildAt: (i: number) => { get: (i: number) => unknown } | null;
}): Record<string, unknown>[] {
  const cols = result.schema.fields.map((f) => f.name);
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < result.numRows; i++) {
    const row: Record<string, unknown> = {};
    for (let c = 0; c < cols.length; c++) {
      const value = result.getChildAt(c)?.get(i);
      row[cols[c]] = typeof value === "bigint" ? Number(value) : value;
    }
    rows.push(row);
  }
  return rows;
}

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "bigint" ? Number(v) : Number(v);
  return isNaN(n) ? null : n;
}

function toStr(v: unknown): string {
  if (v == null) return "";
  return String(v);
}

function extractUnnestedEpoch(row: Record<string, unknown>): Record<string, unknown> {
  // DuckDB-WASM may return UNNEST(epochs) either as expanded columns
  // (timenum/class_id/...) or as a single struct under key "unnest(epochs)".
  // Normalize both shapes so downstream logic is consistent.
  const nested = row["unnest(epochs)"];
  if (
    nested &&
    typeof nested === "object" &&
    !Array.isArray(nested)
  ) {
    return nested as Record<string, unknown>;
  }
  return row;
}

/**
 * Build a WHERE condition for calendar_date that works regardless of
 * whether the column is DATE, VARCHAR, or TIMESTAMP.
 * We always CAST to VARCHAR so we can match the `YYYY-MM-DD` strings
 * that getParticipantDays returns.
 */
function dateCondition(dateStr: string): string {
  return `CAST(calendar_date AS VARCHAR) = '${dateStr.replace(/'/g, "''")}'`;
}

function idCondition(idCol: string, pid: string): string {
  return `CAST("${idCol}" AS VARCHAR) = '${pid.replace(/'/g, "''")}'`;
}

// ---------------------------------------------------------------------------
// Check if epochs column exists
// ---------------------------------------------------------------------------

export async function hasEpochsColumn(fileName: string): Promise<boolean> {
  const db = await initDuckDB();
  const conn = await db.connect();
  try {
    const result = await conn.query(
      `SELECT name FROM parquet_schema('${fileName}') WHERE name = 'epochs'`
    );
    return result.numRows > 0;
  } catch {
    return false;
  } finally {
    await conn.close();
  }
}

// ---------------------------------------------------------------------------
// Get participants list
// ---------------------------------------------------------------------------

export async function getEpochParticipants(fileName: string): Promise<string[]> {
  const db = await initDuckDB();
  const conn = await db.connect();
  try {
    const idCol = await detectIdColumn(conn, fileName);
    const result = await conn.query(
      `SELECT DISTINCT CAST("${idCol}" AS VARCHAR) as id FROM '${fileName}' ORDER BY id`
    );
    const rows = arrowToPlainRows(result);
    return rows.map((r) => toStr(r.id)).filter(Boolean);
  } finally {
    await conn.close();
  }
}

// ---------------------------------------------------------------------------
// Get available dates for a participant
// ---------------------------------------------------------------------------

export async function getParticipantDays(
  fileName: string,
  participantId: string
): Promise<ParticipantDay[]> {
  const db = await initDuckDB();
  const conn = await db.connect();
  try {
    const idCol = await detectIdColumn(conn, fileName);
    const pid = participantId.replace(/'/g, "''");

    // Check if weekday column exists
    const schemaResult = await conn.query(
      `SELECT name FROM parquet_schema('${fileName}') WHERE name = 'weekday'`
    );
    const hasWeekday = schemaResult.numRows > 0;
    const weekdaySelect = hasWeekday ? ", weekday" : "";

    const result = await conn.query(
      `SELECT CAST("${idCol}" AS VARCHAR) as id, CAST(calendar_date AS VARCHAR) as calendar_date${weekdaySelect} FROM '${fileName}' WHERE ${idCondition(idCol, pid)} ORDER BY calendar_date`
    );
    const rows = arrowToPlainRows(result);
    return rows.map((r) => ({
      id: toStr(r.id),
      calendar_date: toStr(r.calendar_date),
      weekday: toStr(r.weekday ?? ""),
    }));
  } finally {
    await conn.close();
  }
}

// ---------------------------------------------------------------------------
// Get day summary metrics (top-level columns)
// ---------------------------------------------------------------------------

const SUMMARY_COLS = [
  "sleeponset", "wakeup", "dur_spt_sleep_min", "dur_spt_min",
  "dur_day_mvpa_bts_10_min", "nonwear_perc_day", "acc_day_mg",
] as const;

export async function getDaySummary(
  fileName: string,
  participantId: string,
  calendarDate: string
): Promise<DaySummary | null> {
  const db = await initDuckDB();
  const conn = await db.connect();
  try {
    const idCol = await detectIdColumn(conn, fileName);

    // Detect which summary columns actually exist
    const schemaResult = await conn.query(
      `SELECT name FROM parquet_schema('${fileName}') WHERE name != 'duckdb_schema'`
    );
    const schemaRows = arrowToPlainRows(schemaResult);
    const availableCols = new Set(schemaRows.map((r) => toStr(r.name)));

    const selectParts = [
      `CAST("${idCol}" AS VARCHAR) as id`,
      `CAST(calendar_date AS VARCHAR) as calendar_date`,
    ];
    if (availableCols.has("weekday")) {
      selectParts.push(`weekday`);
    }
    for (const col of SUMMARY_COLS) {
      if (availableCols.has(col)) {
        selectParts.push(`"${col}"`);
      }
    }

    const pid = participantId.replace(/'/g, "''");
    const result = await conn.query(
      `SELECT ${selectParts.join(", ")} FROM '${fileName}' WHERE ${idCondition(idCol, pid)} AND ${dateCondition(calendarDate)} LIMIT 1`
    );
    const rows = arrowToPlainRows(result);
    if (rows.length === 0) return null;
    const r = rows[0];
    const sptMin = toNum(r.dur_spt_min);
    const sleepMin = toNum(r.dur_spt_sleep_min);
    return {
      id: toStr(r.id),
      calendar_date: toStr(r.calendar_date),
      weekday: toStr(r.weekday),
      sleeponset: toNum(r.sleeponset),
      wakeup: toNum(r.wakeup),
      dur_spt_sleep_min: sleepMin,
      dur_spt_min: sptMin,
      waso: (sptMin != null && sleepMin != null) ? sptMin - sleepMin : null,
      dur_day_mvpa_bts_10_min: toNum(r.dur_day_mvpa_bts_10_min),
      nonwear_perc_day: toNum(r.nonwear_perc_day),
      acc_day_mg: toNum(r.acc_day_mg),
    };
  } finally {
    await conn.close();
  }
}

// ---------------------------------------------------------------------------
// Get ALL day summaries for a participant (for trend charts)
// ---------------------------------------------------------------------------

export async function getAllDaySummaries(
  fileName: string,
  participantId: string
): Promise<DaySummary[]> {
  const db = await initDuckDB();
  const conn = await db.connect();
  try {
    const idCol = await detectIdColumn(conn, fileName);

    const schemaResult = await conn.query(
      `SELECT name FROM parquet_schema('${fileName}') WHERE name != 'duckdb_schema'`
    );
    const schemaRows = arrowToPlainRows(schemaResult);
    const availableCols = new Set(schemaRows.map((r) => toStr(r.name)));

    const selectParts = [
      `CAST("${idCol}" AS VARCHAR) as id`,
      `CAST(calendar_date AS VARCHAR) as calendar_date`,
    ];
    if (availableCols.has("weekday")) selectParts.push(`weekday`);
    for (const col of SUMMARY_COLS) {
      if (availableCols.has(col)) selectParts.push(`"${col}"`);
    }

    const pid = participantId.replace(/'/g, "''");
    const result = await conn.query(
      `SELECT ${selectParts.join(", ")} FROM '${fileName}' WHERE ${idCondition(idCol, pid)} ORDER BY calendar_date`
    );
    const rows = arrowToPlainRows(result);
    return rows.map((r) => {
      const sptMin = toNum(r.dur_spt_min);
      const sleepMin = toNum(r.dur_spt_sleep_min);
      return {
        id: toStr(r.id),
        calendar_date: toStr(r.calendar_date),
        weekday: toStr(r.weekday),
        sleeponset: toNum(r.sleeponset),
        wakeup: toNum(r.wakeup),
        dur_spt_sleep_min: sleepMin,
        dur_spt_min: sptMin,
        waso: (sptMin != null && sleepMin != null) ? sptMin - sleepMin : null,
        dur_day_mvpa_bts_10_min: toNum(r.dur_day_mvpa_bts_10_min),
        nonwear_perc_day: toNum(r.nonwear_perc_day),
        acc_day_mg: toNum(r.acc_day_mg),
      };
    });
  } finally {
    await conn.close();
  }
}

// ---------------------------------------------------------------------------
// Get unnested epoch data for a single participant+day
// ---------------------------------------------------------------------------

export async function getEpochs(
  fileName: string,
  participantId: string,
  calendarDate: string
): Promise<{ epochs: EpochRow[]; hasAnglez: boolean; hasLux: boolean; hasTemperature: boolean }> {
  const db = await initDuckDB();
  const conn = await db.connect();
  try {
    const idCol = await detectIdColumn(conn, fileName);
    const pid = participantId.replace(/'/g, "''");
    const dateCond = dateCondition(calendarDate);

    // Probe: detect optional struct fields by unnesting one row
    let hasAnglez = false;
    let hasLux = false;
    let hasTemperature = false;

    const idCond = idCondition(idCol, pid);

    try {
      const probeResult = await conn.query(
        `SELECT UNNEST(epochs) FROM '${fileName}' WHERE ${idCond} AND ${dateCond} LIMIT 1`
      );
      const probeRows = arrowToPlainRows(probeResult);
      const first = probeRows[0] ? extractUnnestedEpoch(probeRows[0]) : null;
      const probeCols = new Set(first ? Object.keys(first) : []);
      hasAnglez = probeCols.has("anglez");
      hasLux = probeCols.has("lux");
      hasTemperature = probeCols.has("temperature");
    } catch {
      // probe failed — proceed with required fields only
    }

    // Main query: flat UNNEST (no subquery)
    const result = await conn.query(
      `SELECT UNNEST(epochs) FROM '${fileName}' WHERE ${idCond} AND ${dateCond}`
    );

    const rows = arrowToPlainRows(result).map(extractUnnestedEpoch);

    // Sort by timenum in JS (ORDER BY can't be used with UNNEST in same SELECT)
    rows.sort((a, b) => (toNum(a.timenum) ?? 0) - (toNum(b.timenum) ?? 0));

    const epochs: EpochRow[] = rows.map((r) => ({
      timenum: toNum(r.timenum) ?? 0,
      acc: toNum(r.acc) ?? 0,
      class_id: toNum(r.class_id) ?? 0,
      spt: Boolean(r.spt),
      invalid: Boolean(r.invalid),
      window: toNum(r.window) ?? 0,
      ...(hasAnglez && { anglez: toNum(r.anglez) ?? undefined }),
      ...(hasLux && { lux: toNum(r.lux) ?? undefined }),
      ...(hasTemperature && { temperature: toNum(r.temperature) ?? undefined }),
    }));

    return { epochs, hasAnglez, hasLux, hasTemperature };
  } finally {
    await conn.close();
  }
}

// ---------------------------------------------------------------------------
// Get condensed epoch summary for multi-day stacked view.
// Strategy: fetch ALL epochs in a single UNNEST (the proven working pattern),
// then assign each epoch to a day using its `window` field and pair with
// day-level metadata fetched separately.
// ---------------------------------------------------------------------------

export async function getMultiDayEpochSummary(
  fileName: string,
  participantId: string
): Promise<{ calendar_date: string; weekday: string; epochs: { timenum: number; class_id: number; spt: boolean; invalid: boolean }[] }[]> {
  const db = await initDuckDB();
  const conn = await db.connect();
  try {
    const idCol = await detectIdColumn(conn, fileName);
    const pid = participantId.replace(/'/g, "''");
    const idCond = idCondition(idCol, pid);

    // Check if weekday column exists
    const schemaResult = await conn.query(
      `SELECT name FROM parquet_schema('${fileName}') WHERE name = 'weekday'`
    );
    const hasWeekday = schemaResult.numRows > 0;
    const weekdaySelect = hasWeekday ? ", weekday" : "";

    // Step 1: get ordered day-level metadata (window_number → date mapping)
    const daysResult = await conn.query(
      `SELECT DISTINCT CAST(calendar_date AS VARCHAR) as calendar_date${weekdaySelect} FROM '${fileName}' WHERE ${idCond} ORDER BY calendar_date`
    );
    const dayRows = arrowToPlainRows(daysResult);
    if (dayRows.length === 0) return [];

    // Step 2: unnest ALL epochs for this participant in a single query
    const epochResult = await conn.query(
      `SELECT UNNEST(epochs) FROM '${fileName}' WHERE ${idCond}`
    );
    const allEpochRows = arrowToPlainRows(epochResult);

    // Group epochs by `window` field (each window = one day, numbered 1..N)
    const windowMap = new Map<number, { timenum: number; class_id: number; spt: boolean; invalid: boolean }[]>();
    for (const row of allEpochRows) {
      const r = extractUnnestedEpoch(row);
      const w = toNum(r.window) ?? 0;
      if (!windowMap.has(w)) windowMap.set(w, []);
      windowMap.get(w)!.push({
        timenum: toNum(r.timenum) ?? 0,
        class_id: toNum(r.class_id) ?? 0,
        spt: Boolean(r.spt),
        invalid: Boolean(r.invalid),
      });
    }

    // Sort each window's epochs by timenum
    for (const epochs of windowMap.values()) {
      epochs.sort((a, b) => a.timenum - b.timenum);
    }

    // Pair windows with day-level metadata.
    // Windows are typically numbered starting from 1 and ordered by date.
    const sortedWindows = Array.from(windowMap.keys()).sort((a, b) => a - b);

    const result: { calendar_date: string; weekday: string; epochs: { timenum: number; class_id: number; spt: boolean; invalid: boolean }[] }[] = [];

    if (sortedWindows.length === dayRows.length) {
      // Direct 1:1 mapping between sorted windows and sorted day rows
      for (let i = 0; i < dayRows.length; i++) {
        result.push({
          calendar_date: toStr(dayRows[i].calendar_date),
          weekday: toStr(dayRows[i].weekday ?? ""),
          epochs: windowMap.get(sortedWindows[i]) ?? [],
        });
      }
    } else {
      // Fallback: assign epochs to days by timestamp.
      // Compute midnight boundaries from each day's first epoch timestamp.
      // Group all epochs into date buckets.
      const dateBuckets = new Map<string, { timenum: number; class_id: number; spt: boolean; invalid: boolean }[]>();
      for (const epochs of windowMap.values()) {
        for (const e of epochs) {
          const d = new Date(e.timenum * 1000);
          const dateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
          if (!dateBuckets.has(dateStr)) dateBuckets.set(dateStr, []);
          dateBuckets.get(dateStr)!.push(e);
        }
      }

      for (const dayRow of dayRows) {
        const calDate = toStr(dayRow.calendar_date);
        const epochs = dateBuckets.get(calDate) ?? [];
        epochs.sort((a, b) => a.timenum - b.timenum);
        result.push({
          calendar_date: calDate,
          weekday: toStr(dayRow.weekday ?? ""),
          epochs,
        });
      }
    }

    return result;
  } finally {
    await conn.close();
  }
}

// ---------------------------------------------------------------------------
// Internal: detect the id column name
// ---------------------------------------------------------------------------

async function detectIdColumn(
  conn: { query: (sql: string) => Promise<{ schema: { fields: { name: string }[] }; numRows: number; getChildAt: (i: number) => { get: (i: number) => unknown } | null }> },
  fileName: string
): Promise<string> {
  const result = await conn.query(
    `SELECT name FROM parquet_schema('${fileName}') WHERE name IN ('id', 'filename', 'device_sn') LIMIT 3`
  );
  const rows = arrowToPlainRows(result);
  const names = rows.map((r) => toStr(r.name));
  if (names.includes("id")) return "id";
  if (names.includes("filename")) return "filename";
  if (names.includes("device_sn")) return "device_sn";
  return "id";
}

// ---------------------------------------------------------------------------
// Class ID label and color mapping
// ---------------------------------------------------------------------------

// Default class_id mapping per GGIR data model (Section 4 of GGIR_DATA_MODEL.md).
// The actual mapping may vary per file — use parseBehavioralCodes() to read
// the `behavioral_codes` parquet metadata key at runtime.
const DEFAULT_LABELS: Record<number, string> = {
  0: "Inactive (waking)",
  1: "Light PA (waking)",
  2: "Moderate PA (waking)",
  3: "Vigorous PA (waking)",
  4: "Sleep (SPT)",
  5: "Awake-inactive (SPT)",
  6: "Awake-light (SPT)",
  7: "Awake-moderate (SPT)",
  8: "Awake-vigorous (SPT)",
};

// Visually distinct palette — every class must be clearly visible on white.
const DEFAULT_COLORS: Record<number, string> = {
  0: "#9ca3af",   // grey — inactive / sedentary (visible on white)
  1: "#22c55e",   // green — light PA
  2: "#f97316",   // orange — moderate PA
  3: "#ef4444",   // red — vigorous PA
  4: "#1e3a5f",   // dark navy — sleep
  5: "#64748b",   // slate — awake-inactive during SPT
  6: "#86efac",   // light green — awake-light during SPT
  7: "#fdba74",   // light orange — awake-moderate during SPT
  8: "#f87171",   // light red — awake-vigorous during SPT
};

// Runtime labels/colors — mutated in-place by parseBehavioralCodes().
// Using a single object with mutations ensures webpack module bindings propagate.
export const CLASS_LABELS: Record<number, string> = { ...DEFAULT_LABELS };
export const CLASS_COLORS: Record<number, string> = { ...DEFAULT_COLORS };

/**
 * Parse the `behavioral_codes` key from parquet KV metadata.
 * Expected format: JSON object mapping class_id (as string) to label string.
 * Mutates CLASS_LABELS in-place so all importers see the updated mapping.
 */
export function parseBehavioralCodes(kvMetadata: Record<string, string>): void {
  const raw = kvMetadata["behavioral_codes"];
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    for (const [key, label] of Object.entries(parsed)) {
      const id = Number(key);
      if (!isNaN(id)) {
        CLASS_LABELS[id] = String(label);
      }
    }
  } catch {
    // malformed JSON — keep defaults
  }
}

/** Reset to default labels/colors (useful if a new file is loaded). */
export function resetClassMapping(): void {
  for (const key of Object.keys(CLASS_LABELS)) delete CLASS_LABELS[Number(key)];
  for (const key of Object.keys(CLASS_COLORS)) delete CLASS_COLORS[Number(key)];
  Object.assign(CLASS_LABELS, DEFAULT_LABELS);
  Object.assign(CLASS_COLORS, DEFAULT_COLORS);
}

// class_ids that represent MVPA (moderate + vigorous, both waking and SPT)
export const MVPA_CLASS_IDS = new Set([2, 3, 7, 8]);
