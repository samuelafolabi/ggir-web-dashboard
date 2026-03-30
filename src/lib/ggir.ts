/**
 * GGIR-specific data utilities: column detection, derived metrics,
 * filtering, and unit conversion.
 */

// ---------------------------------------------------------------------------
// Column name constants
// ---------------------------------------------------------------------------

export const GGIR_COLUMNS = {
  // Identity / time (Section 3a of GGIR_DATA_MODEL.md)
  id: "id",
  calendarDate: "calendar_date",
  deviceSn: "device_sn",
  device: "device",
  filename: "filename",
  weekday: "weekday",
  daytype: "daytype",

  // Data quality (Part 2 — Section 3f)
  nonwearPercDay: "nonwear_perc_day",
  nonwearPercSpt: "nonwear_perc_spt",
  nonwearPercDaySpt: "nonwear_perc_day_spt",
  calibErr: "calib_err",
  calErrorStart: "cal_error_start",
  calErrorEnd: "cal_error_end",

  // Recording metadata (Section 3g)
  bodylocation: "bodylocation",
  samplefreq: "samplefreq",
  measDurDys: "meas_dur_dys",

  // Sleep (Part 4 — Section 3b)
  sleeponset: "sleeponset",
  wakeup: "wakeup",
  sleepEfficiency: "sleep_efficiency_after_onset",
  durSptMin: "dur_spt_min",
  durSptSleepMin: "dur_spt_sleep_min",
  nightNumber: "night_number",
  cleaningcode: "cleaningcode",
  nWakeBouts: "n_atleast5minwakenight",

  // Physical activity (Part 2 & 5 — Sections 3c, 3d, 3h)
  accDayMg: "acc_day_mg",
  meanEnmo: "mean_enmo_mg_0_24hr",
  durDayMvpa: "dur_day_mvpa_bts_10_min",
  durDayTotalLig: "dur_day_total_lig_min",
  durDayTotalMod: "dur_day_total_mod_min",
  durDayTotalVig: "dur_day_total_vig_min",
  durDayTotalIn: "dur_day_total_in_min",
  durDayMin: "dur_day_min",
} as const;

// ---------------------------------------------------------------------------
// Module detection
// ---------------------------------------------------------------------------

export type AvailableModules = {
  dataQuality: boolean;
  sleep: boolean;
  physicalActivity: boolean;
};

/** Determine which dashboard tabs can be shown based on available columns. */
export function detectAvailableModules(columns: string[]): AvailableModules {
  const has = (col: string) => columns.includes(col);
  return {
    dataQuality:
      has(GGIR_COLUMNS.nonwearPercDay) ||
      has(GGIR_COLUMNS.calibErr) ||
      has(GGIR_COLUMNS.calErrorStart),
    sleep:
      has(GGIR_COLUMNS.sleeponset) || has(GGIR_COLUMNS.wakeup),
    physicalActivity:
      has(GGIR_COLUMNS.accDayMg) ||
      has(GGIR_COLUMNS.meanEnmo) ||
      has(GGIR_COLUMNS.durDayMvpa) ||
      has(GGIR_COLUMNS.durDayTotalIn),
  };
}

/** Check whether a specific column exists in the dataset */
export function hasColumn(columns: string[], col: string): boolean {
  return columns.includes(col);
}

// ---------------------------------------------------------------------------
// Type-safe value helpers
// ---------------------------------------------------------------------------

export function toNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return isNaN(v) ? null : v;
  if (typeof v === "bigint") return Number(v);
  const n = Number(v);
  return isNaN(n) ? null : n;
}

export function toString(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

type Row = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Validity
// ---------------------------------------------------------------------------

export type ValidityStatus = "valid" | "marginal" | "invalid";

export interface ValidityResult {
  status: ValidityStatus;
  avgValidHours: number | null;
  avgCalibError: number | null;
}

export function computeValidity(rows: Row[], columns: string[]): ValidityResult {
  let avgValidHours: number | null = null;
  let avgCalibError: number | null = null;

  // Derive valid hours from nonwear_perc_day_spt or nonwear_perc_day
  const nonwearCol = hasColumn(columns, GGIR_COLUMNS.nonwearPercDaySpt)
    ? GGIR_COLUMNS.nonwearPercDaySpt
    : hasColumn(columns, GGIR_COLUMNS.nonwearPercDay)
    ? GGIR_COLUMNS.nonwearPercDay
    : null;
  if (nonwearCol) {
    const vals = rows
      .map((r) => toNumber(r[nonwearCol]))
      .filter((v): v is number => v !== null);
    if (vals.length > 0) {
      const avgNonwearPct = vals.reduce((a, b) => a + b, 0) / vals.length;
      avgValidHours = 24 * (1 - avgNonwearPct / 100);
    }
  }

  // Try calib_err first (GGIR data model), then cal_error_end as fallback
  const calibCol = hasColumn(columns, GGIR_COLUMNS.calibErr)
    ? GGIR_COLUMNS.calibErr
    : hasColumn(columns, GGIR_COLUMNS.calErrorEnd)
    ? GGIR_COLUMNS.calErrorEnd
    : null;
  if (calibCol) {
    const vals = rows.map((r) => toNumber(r[calibCol])).filter((v): v is number => v !== null);
    avgCalibError = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }

  let status: ValidityStatus = "marginal";
  if (avgValidHours !== null) {
    if (avgValidHours >= 16) status = "valid";
    else if (avgValidHours < 10) status = "invalid";
  }
  if (avgCalibError !== null && avgCalibError > 0.01) {
    status = "invalid";
  }

  return { status, avgValidHours, avgCalibError };
}

// ---------------------------------------------------------------------------
// Wear time
// ---------------------------------------------------------------------------

export function computeAverageWearTime(rows: Row[], columns: string[]): number | null {
  // Use the same column priority as computeValidity for consistency
  const nonwearCol = hasColumn(columns, GGIR_COLUMNS.nonwearPercDaySpt)
    ? GGIR_COLUMNS.nonwearPercDaySpt
    : hasColumn(columns, GGIR_COLUMNS.nonwearPercDay)
    ? GGIR_COLUMNS.nonwearPercDay
    : null;
  if (!nonwearCol) return null;
  const vals = rows
    .map((r) => toNumber(r[nonwearCol]))
    .filter((v): v is number => v !== null);
  if (vals.length === 0) return null;
  const avgNonwearPerc = vals.reduce((a, b) => a + b, 0) / vals.length;
  return 24 * (1 - avgNonwearPerc / 100);
}

// ---------------------------------------------------------------------------
// Sleep metrics
// ---------------------------------------------------------------------------

export function computeSleepEfficiency(rows: Row[], columns: string[]): number | null {
  // Use pre-computed column if available
  if (hasColumn(columns, GGIR_COLUMNS.sleepEfficiency)) {
    const vals = rows
      .map((r) => toNumber(r[GGIR_COLUMNS.sleepEfficiency]))
      .filter((v): v is number => v !== null);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }
  // Compute from duration columns
  if (hasColumn(columns, GGIR_COLUMNS.durSptSleepMin) && hasColumn(columns, GGIR_COLUMNS.durSptMin)) {
    const effs: number[] = [];
    for (const r of rows) {
      const sleep = toNumber(r[GGIR_COLUMNS.durSptSleepMin]);
      const spt = toNumber(r[GGIR_COLUMNS.durSptMin]);
      if (sleep !== null && spt !== null && spt > 0) {
        effs.push((sleep / spt) * 100);
      }
    }
    return effs.length > 0 ? effs.reduce((a, b) => a + b, 0) / effs.length : null;
  }
  return null;
}

/** Compute mean WASO (dur_spt_min - dur_spt_sleep_min) */
export function computeMeanWASO(rows: Row[], columns: string[]): number | null {
  if (!hasColumn(columns, GGIR_COLUMNS.durSptMin) || !hasColumn(columns, GGIR_COLUMNS.durSptSleepMin)) return null;
  const vals: number[] = [];
  for (const r of rows) {
    const spt = toNumber(r[GGIR_COLUMNS.durSptMin]);
    const sleep = toNumber(r[GGIR_COLUMNS.durSptSleepMin]);
    if (spt != null && sleep != null) vals.push(spt - sleep);
  }
  return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

/** Get per-row WASO values (dur_spt_min - dur_spt_sleep_min) */
export function getWASOValues(rows: Row[], columns: string[]): (number | null)[] {
  if (!hasColumn(columns, GGIR_COLUMNS.durSptMin) || !hasColumn(columns, GGIR_COLUMNS.durSptSleepMin)) {
    return rows.map(() => null);
  }
  return rows.map((r) => {
    const spt = toNumber(r[GGIR_COLUMNS.durSptMin]);
    const sleep = toNumber(r[GGIR_COLUMNS.durSptSleepMin]);
    return (spt != null && sleep != null) ? spt - sleep : null;
  });
}

export function computeMeanSleepDuration(rows: Row[], columns: string[]): number | null {
  if (!hasColumn(columns, GGIR_COLUMNS.durSptSleepMin)) return null;
  const vals = rows
    .map((r) => toNumber(r[GGIR_COLUMNS.durSptSleepMin]))
    .filter((v): v is number => v !== null);
  return vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length) / 60 : null;
}

// ---------------------------------------------------------------------------
// Physical activity intensity breakdown
// ---------------------------------------------------------------------------

export interface IntensityBreakdown {
  sedentary: number;
  light: number;
  moderate: number;
  vigorous: number;
}

export function computeIntensityBreakdown(rows: Row[], columns: string[]): IntensityBreakdown | null {
  const inCol = hasColumn(columns, GGIR_COLUMNS.durDayTotalIn) ? GGIR_COLUMNS.durDayTotalIn : null;
  const ligCol = hasColumn(columns, GGIR_COLUMNS.durDayTotalLig) ? GGIR_COLUMNS.durDayTotalLig : null;
  const modCol = hasColumn(columns, GGIR_COLUMNS.durDayTotalMod) ? GGIR_COLUMNS.durDayTotalMod : null;
  const vigCol = hasColumn(columns, GGIR_COLUMNS.durDayTotalVig) ? GGIR_COLUMNS.durDayTotalVig : null;

  if (!inCol && !ligCol && !modCol && !vigCol) return null;

  const mean = (col: string | null) => {
    if (!col) return 0;
    const vals = rows.map((r) => toNumber(r[col])).filter((v): v is number => v !== null);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  };

  return {
    sedentary: mean(inCol),
    light: mean(ligCol),
    moderate: mean(modCol),
    vigorous: mean(vigCol),
  };
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

export function filterByDays(rows: Row[], selectedDays: Set<string>): Row[] {
  return rows.filter((r) => {
    const date = toString(r[GGIR_COLUMNS.calendarDate]);
    return date === "" || selectedDays.has(date);
  });
}

export type DayType = "all" | "weekday" | "weekend";

export function filterByDayType(rows: Row[], dayType: DayType): Row[] {
  if (dayType === "all") return rows;
  return rows.filter((r) => {
    // Prefer the daytype column ("WD" / "WE") if available
    const dt = toString(r[GGIR_COLUMNS.daytype]).toUpperCase();
    if (dt === "WD" || dt === "WE") {
      return dayType === "weekend" ? dt === "WE" : dt === "WD";
    }
    // Fall back to weekday column (e.g. "Thursday", "Saturday")
    const wd = toString(r[GGIR_COLUMNS.weekday]).toLowerCase();
    if (wd) {
      const isWeekend = wd === "saturday" || wd === "sunday";
      return dayType === "weekend" ? isWeekend : !isWeekend;
    }
    // Last resort: parse the calendar_date
    const raw = r[GGIR_COLUMNS.calendarDate];
    const date = parseDateValue(raw);
    if (!date) return true;
    const day = date.getDay();
    const isWeekend = day === 0 || day === 6;
    return dayType === "weekend" ? isWeekend : !isWeekend;
  });
}

/** Parse a raw date value (epoch ms/s, ISO string, etc.) into a Date object */
function parseDateValue(raw: unknown): Date | null {
  if (raw === null || raw === undefined) return null;
  const s = typeof raw === "bigint" ? Number(raw).toString() : String(raw);
  if (!s) return null;

  const num = Number(s);
  if (!isNaN(num) && isFinite(num) && num > 1e8) {
    const ms = num > 1e12 ? num : num * 1000;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) return d;
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// ---------------------------------------------------------------------------
// Unit conversion
// ---------------------------------------------------------------------------

export type AccelUnit = "mg" | "ms2";

const MG_TO_MS2 = 0.00981;

export function convertAcceleration(value: number, unit: AccelUnit): number {
  return unit === "ms2" ? value * MG_TO_MS2 : value;
}

export function accelUnitLabel(unit: AccelUnit): string {
  return unit === "ms2" ? "m/s\u00B2" : "mg";
}

// ---------------------------------------------------------------------------
// Stats helpers
// ---------------------------------------------------------------------------

export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sqDiffs = values.map((v) => (v - mean) ** 2);
  return Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / (values.length - 1));
}

export function getAllDates(rows: Row[]): string[] {
  const dates: string[] = [];
  for (const r of rows) {
    const d = toString(r[GGIR_COLUMNS.calendarDate]);
    if (d && !dates.includes(d)) dates.push(d);
  }
  return dates;
}

export function getDeviceId(rows: Row[], columns: string[]): string | null {
  if (!hasColumn(columns, GGIR_COLUMNS.deviceSn)) return null;
  const val = rows[0]?.[GGIR_COLUMNS.deviceSn];
  return val != null ? toString(val) : null;
}

export function getDevice(rows: Row[], columns: string[]): string | null {
  if (!hasColumn(columns, GGIR_COLUMNS.device)) return null;
  const val = rows[0]?.[GGIR_COLUMNS.device];
  return val != null ? toString(val) : null;
}
// ---------------------------------------------------------------------------
// Date formatting — handles epoch ms, epoch s, ISO strings, etc.
// ---------------------------------------------------------------------------

/**
 * Format a raw date value from the parquet file into a human-readable label.
 * Handles:
 *  - Epoch milliseconds (e.g. 1466812800000)
 *  - Epoch seconds (e.g. 1466812800)
 *  - ISO date strings ("2016-06-25")
 *  - Already formatted strings pass through
 *
 * Returns e.g. "Thu Jun 23, 2016"
 */
export function formatDate(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  const s = typeof raw === "bigint" ? Number(raw).toString() : String(raw);
  if (!s) return "";

  // Try parsing as a number (epoch)
  const num = Number(s);
  if (!isNaN(num) && isFinite(num) && num > 1e8) {
    // Distinguish epoch ms vs epoch s
    const ms = num > 1e12 ? num : num * 1000;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
  }

  // Try parsing as a date string
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  // Fallback: return as-is
  return s;
}

/**
 * Get a display label for a row's day.
 * Prefers the weekday column if available, then falls back to formatDate.
 */
export function getDayLabel(row: Row, columns: string[]): string {
  // If the file has a weekday column, combine it with the formatted date
  if (hasColumn(columns, GGIR_COLUMNS.weekday)) {
    const wd = toString(row[GGIR_COLUMNS.weekday]);
    const raw = row[GGIR_COLUMNS.calendarDate];
    const formatted = formatDate(raw);
    if (wd && formatted) return `${wd} (${formatted})`;
    if (wd) return wd;
  }
  return formatDate(row[GGIR_COLUMNS.calendarDate]);
}

/**
 * Build a parallel array of display labels for rows.
 */
export function getDayLabels(rows: Row[], columns: string[]): string[] {
  return rows.map((r, i) => getDayLabel(r, columns) || `Day ${i + 1}`);
}

// ---------------------------------------------------------------------------
// Participant helpers (multi-participant files)
// ---------------------------------------------------------------------------

/** Auto-detect the participant ID column. Prefers `id` (GGIR primary key), then filename, then device_sn. */
export function getParticipantColumn(columns: string[]): string | null {
  if (hasColumn(columns, GGIR_COLUMNS.id)) return GGIR_COLUMNS.id;
  if (hasColumn(columns, GGIR_COLUMNS.filename)) return GGIR_COLUMNS.filename;
  if (hasColumn(columns, GGIR_COLUMNS.deviceSn)) return GGIR_COLUMNS.deviceSn;
  return null;
}

/** Extract all unique participant IDs from the data */
export function getAllParticipants(rows: Row[], columns: string[]): string[] {
  const col = getParticipantColumn(columns);
  if (!col) return [];
  const ids: string[] = [];
  for (const r of rows) {
    const id = toString(r[col]);
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** Filter rows to a specific participant. Pass null to include all. */
export function filterByParticipant(rows: Row[], participantId: string | null, columns: string[]): Row[] {
  if (!participantId) return rows;
  const col = getParticipantColumn(columns);
  if (!col) return rows;
  return rows.filter((r) => toString(r[col]) === participantId);
}
