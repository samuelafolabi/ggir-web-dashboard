# GGIR Parquet Data Model Reference

This web app reads a single file called `ggir_results.parquet`, produced by the [GGIR](https://cran.r-project.org/package=GGIR) R package. GGIR processes raw accelerometer data (wrist- or hip-worn) and produces physical-activity, sleep, and circadian-rhythm summaries. Understanding the data model below is essential for building correct queries and visualizations.

---

## 1. What GGIR is

GGIR is a 6-part pipeline for wearable accelerometer data:

| Part | Purpose |
|------|---------|
| **Part 1** | Read raw sensor file, auto-calibrate, derive epoch-level acceleration (e.g. ENMO in milli-gravity) |
| **Part 2** | Day-level physical activity summaries (L5/M5 least/most active 5-hour windows, MVPA) |
| **Part 3** | Sleep-period-time (SPT) detection from sustained inactivity bouts |
| **Part 4** | Night-level sleep summaries (onset, wakeup, WASO, efficiency) |
| **Part 5** | Day-level combined activity + sleep classification -- the **most granular summary level** and the backbone of the Parquet file |
| **Part 6** | (Optional) Household co-analysis |

---

## 2. File structure -- `ggir_results.parquet`

The Parquet file is a **single flat-ish table** with **one row per (participant, calendar_date)** at the day level. It also contains a **nested list-column called `epochs`** holding the epoch-level (typically 5-second) time series for that day.

**Primary key:** `(id, calendar_date)`

---

## 3. Top-level columns (day-level summaries)

All column names are **lowercased and SQL-safe** (special characters replaced with underscores). Below are the key groups:

### 3a. Identifiers & time

| Column | Type | Meaning |
|--------|------|---------|
| `id` | STRING | Participant/file identifier |
| `filename` | STRING | Original accelerometer filename |
| `calendar_date` | DATE | The calendar day this row represents |
| `weekday` | STRING | Day of week (e.g. "Thursday") |
| `daytype` | STRING | "WD" (weekday) or "WE" (weekend) |
| `window_number` | INT | Sequential day number in the recording |
| `start_end_window` | STRING | Time window (e.g. "00:00:00-23:59:55") |

### 3b. Sleep columns (from Part 4 & 5)

| Column | Type | Meaning |
|--------|------|---------|
| `sleeponset` | DOUBLE | Sleep onset in fractional hours from previous midnight (e.g. 23.5 = 11:30 PM) |
| `sleeponset_ts` | STRING | Sleep onset as HH:MM:SS |
| `wakeup` | DOUBLE | Wake-up time in fractional hours from previous midnight (can exceed 24 if next day) |
| `wakeup_ts` | STRING | Wake-up time as HH:MM:SS |
| `night_number` | INT | Sequential night in the recording |
| `daysleeper` | BOOLEAN | TRUE if wake-up time was after noon |
| `cleaningcode` | INT | Sleep-period-time quality code: 0=OK, 1=no sleeplog, 2=insufficient data, 3=no acc, 4=no nights, 5=guider-defined SPT, 6=SPT not found |
| `guider` | STRING | Algorithm used for SPT detection (e.g. "HDCZA") |
| `sleeplog_used` | BOOLEAN | Whether a sleep diary was used |
| `sleep_efficiency_after_onset` | DOUBLE | Sleep efficiency (%) = time asleep / SPT duration |
| `dur_spt_sleep_min` | DOUBLE | Minutes of sleep during the sleep period |
| `dur_spt_min` | DOUBLE | Total sleep period time in minutes |
| `n_atleast5minwakenight` | INT | Number of wake bouts >= 5 min during the night |

### 3c. Physical activity durations (minutes) -- during **waking time**

| Column pattern | Meaning |
|---------------|---------|
| `dur_day_total_in_min` | Total inactivity (below light threshold) during waking hours |
| `dur_day_total_lig_min` | Total light physical activity |
| `dur_day_total_mod_min` | Total moderate physical activity |
| `dur_day_total_vig_min` | Total vigorous physical activity |
| `dur_day_mvpa_bts_10_min` | MVPA accumulated in bouts >= 10 min |
| `dur_day_mvpa_bts_5_10_min` | MVPA accumulated in bouts 5-10 min |
| `dur_day_mvpa_bts_1_5_min` | MVPA accumulated in bouts 1-5 min |
| `dur_day_in_bts_30_min` | Inactivity accumulated in bouts >= 30 min |
| `dur_day_min` | Total waking time in minutes |
| `dur_day_spt_min` | Full window (waking + sleep period) in minutes |

The `_unbt_` variants are **unbouted** (short, fragmented) activity. The `_bts_` variants are **bout-based** (sustained activity meeting a criterion like 80% of bout above threshold).

Activity during the **sleep period** follows the same pattern but with prefix `dur_spt_wake_*` (e.g. `dur_spt_wake_lig_min`).

### 3d. Acceleration intensity (milli-gravity, mg)

Same pattern as durations but prefixed with `acc_` instead of `dur_`:
- `acc_day_total_in_mg`, `acc_day_total_lig_mg`, `acc_day_mg`, `acc_spt_sleep_mg`, etc.
- These are **mean acceleration** within the given behavioral class/bout type.

### 3e. Bout and block counts

- `nbouts_day_mvpa_bts_10` -- Number of MVPA bouts >= 10 min
- `nblocks_spt_sleep` -- Number of consecutive sleep blocks during SPT
- `nblocks_day_total_in` -- Number of inactivity blocks during waking hours
- (Similar patterns for LIG, MOD, VIG, various bout durations)

### 3f. Data quality / non-wear

| Column | Type | Meaning |
|--------|------|---------|
| `nonwear_perc_day` | DOUBLE | % of waking time classified as non-wear |
| `nonwear_perc_spt` | DOUBLE | % of sleep period classified as non-wear |
| `nonwear_perc_day_spt` | DOUBLE | % of full day (waking + SPT) classified as non-wear |
| `acc_available` | BOOLEAN | Whether accelerometer data was available |
| `file_corrupt` | BOOLEAN | Whether raw file was corrupt (from QC report) |
| `file_too_short` | BOOLEAN | Whether raw file was too short |
| `cal_error_start` / `cal_error_end` | DOUBLE | Calibration error before/after auto-calibration (g) |

### 3g. Recording-level metadata (from Part 2 summary, repeated per day)

| Column | Type | Meaning |
|--------|------|---------|
| `device_sn` | STRING | Device serial number |
| `bodylocation` | STRING | Wear location (e.g. "wrist", "hip") |
| `start_time` | STRING | Recording start as ISO timestamp |
| `samplefreq` | DOUBLE | Sampling frequency in Hz |
| `device` | STRING | Device brand (e.g. "actigraph", "geneactiv") |
| `meas_dur_dys` | DOUBLE | Measurement duration in days |
| `calib_err` | DOUBLE | Calibration error |
| `calib_status` | STRING | Calibration status message |

### 3h. Part 2 daily activity (L5/M5/MVPA)

| Column | Meaning |
|--------|---------|
| `l5hr_enmo_mg_0_24hr` | Hour of the day where L5 (least active 5-hour window) starts |
| `l5_enmo_mg_0_24hr` | Mean acceleration in L5 window (mg) |
| `m5hr_enmo_mg_0_24hr` | Hour of the day where M5 (most active 5-hour window) starts |
| `m5_enmo_mg_0_24hr` | Mean acceleration in M5 window (mg) |
| `mean_enmo_mg_0_24hr` | Mean 24-hr acceleration (mg) |
| `mvpa_e5s_t100_enmo_0_24hr` | Minutes of MVPA (5-sec epochs, threshold 100mg) |

---

## 4. Nested `epochs` column (epoch-level time series)

Each row's `epochs` field is a **LIST of STRUCTs**. Each struct = one epoch (typically 5 seconds). Use DuckDB `UNNEST()` to flatten.

| Field | Type | Meaning |
|-------|------|---------|
| `timenum` | INT64 / DOUBLE | Unix timestamp (seconds since 1970-01-01) |
| `acc` | DOUBLE | Acceleration metric for this epoch (typically ENMO in milli-gravity). The metric name is stored in Parquet metadata key `acc_metric`. |
| `class_id` | INT32 | Behavioral class code (see legend below) |
| `spt` | BOOLEAN | TRUE if this epoch falls within the sleep period time |
| `invalid` | BOOLEAN | TRUE if this epoch was classified as invalid (non-wear, clipping, etc.) |
| `window` | INT32 | Window/day number this epoch belongs to |
| `anglez` | DOUBLE | (optional) Arm angle relative to horizontal, in degrees. Used by sleep detection algorithms. |
| `lux` | DOUBLE | (optional) Light intensity in lux |
| `temperature` | DOUBLE | (optional) Skin/device temperature in Celsius |
| `steps` | INT32 | (optional) Step count for this epoch |

### class_id legend

Stored in Parquet metadata key `behavioral_codes` as JSON:

| class_id | Behavioral class |
|----------|-----------------|
| 0 | Inactive during waking (IN) |
| 1 | Light physical activity (LIG) |
| 2 | Moderate physical activity (MOD) |
| 3 | Vigorous physical activity (VIG) |
| 4 | Sleep during SPT |
| 5 | Awake-inactive during SPT |
| 6 | Awake-light during SPT |
| 7 | Awake-moderate during SPT |
| 8 | Awake-vigorous during SPT |

Exact codes may vary; always read the `behavioral_codes` metadata key at runtime.

---

## 5. Parquet key-value metadata

The file contains custom key-value metadata accessible via DuckDB's `parquet_kv_metadata()` function:

| Key | Value |
|-----|-------|
| `ggir_export` | `"nested_dashboard"` -- identifies this file format |
| `created_at` | ISO timestamp when file was generated |
| `epoch_length_seconds` | Epoch duration (e.g. `"5"`) |
| `acc_metric` | Acceleration metric name (e.g. `"ENMO"`) |
| `behavioral_codes` | JSON map of class_id to class_name |
| `threshold_lig` | Acceleration threshold for light PA (mg) |
| `threshold_mod` | Acceleration threshold for moderate PA (mg) |
| `threshold_vig` | Acceleration threshold for vigorous PA (mg) |
| `threshold_combi` | Threshold combination string (e.g. `"WW_L40M100V400_T5A5"`) |
| `<column_name>` | Human-readable definition for that column (from variable dictionary) |

---

## 6. How to query with DuckDB-WASM

**Read the file:**
```sql
CREATE TABLE ggir AS SELECT * FROM 'ggir_results.parquet';
```

**Day-level summary (no epochs needed -- column pruning skips the large nested data):**
```sql
SELECT id, calendar_date, weekday,
       dur_day_total_mod_min + dur_day_total_vig_min AS mvpa_min,
       dur_spt_sleep_min, sleep_efficiency_after_onset
FROM ggir
WHERE nonwear_perc_day_spt < 25;
```

**Flatten epochs for a specific day:**
```sql
SELECT g.id, g.calendar_date, e.*
FROM ggir g, UNNEST(g.epochs) AS e
WHERE g.id = '123A_testaccfile.csv'
  AND g.calendar_date = '2016-06-24';
```

**Hourly acceleration profile:**
```sql
SELECT g.id, g.calendar_date,
       EXTRACT(HOUR FROM to_timestamp(e.timenum)) AS hour,
       AVG(e.acc) AS mean_acc_mg
FROM ggir g, UNNEST(g.epochs) AS e
WHERE e.invalid = FALSE
GROUP BY 1, 2, 3
ORDER BY 1, 2, 3;
```

**Read metadata:**
```sql
SELECT * FROM parquet_kv_metadata('ggir_results.parquet');
```

---

## 7. Key domain concepts for visualization

- **SPT** = Sleep Period Time (from detected onset to detected wakeup)
- **IN / LIG / MOD / VIG** = Inactivity / Light / Moderate / Vigorous physical activity (thresholds are configurable, stored in metadata)
- **MVPA** = Moderate-to-Vigorous Physical Activity (MOD + VIG combined)
- **Bouts** = Sustained activity periods meeting a duration and intensity criterion (e.g. 80% of a 10-minute window above threshold)
- **Blocks** = Consecutive epochs of the same behavioral class (no bout criterion)
- **L5 / M5** = Least active / Most active 5-hour window in a 24-hour period (circadian rhythm markers)
- **ENMO** = Euclidean Norm Minus One -- the default acceleration metric, expressed in milli-gravity (mg). 1000 mg = 1 g.
- **Non-wear** = periods where the device was not worn; high non-wear % indicates unreliable data for that day
- **Cleaning code** = quality flag for sleep data; code 0 is best, codes >= 2 indicate compromised sleep estimates
