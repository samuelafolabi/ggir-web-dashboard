import Head from "next/head";
import MainLayout from "@/components/MainLayout";
import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

function CodeBlock({ children }: { children: string }) {
  return (
    <pre
      className={`${geistMono.className} overflow-x-auto rounded-lg border bg-muted/50 p-4 text-sm leading-relaxed`}
    >
      <code>{children}</code>
    </pre>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 space-y-4">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">
      {children}
    </code>
  );
}

function SmallCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
      {children}
    </code>
  );
}

const TABLE_OF_CONTENTS = [
  { id: "prerequisites", label: "Prerequisites" },
  { id: "enable-export", label: "How to Enable Parquet Export" },
  { id: "examples", label: "Code Examples" },
  { id: "output-file", label: "Output File" },
  { id: "using-with-dashboard", label: "Using with the Dashboard" },
  { id: "file-contents", label: "What the Parquet File Contains" },
  { id: "developer-notes", label: "Database Schema & Developer Notes" },
  { id: "privacy", label: "Privacy & Data Security" },
  { id: "troubleshooting", label: "Troubleshooting" },
];

const PARQUET_SOURCES = [
  {
    source: "Part 5 day summary",
    description:
      "Day-level physical activity and time-use data. This forms the base of the file.",
  },
  {
    source: "Part 4 night summary",
    description:
      "Per-night sleep variables (sleep onset, wake time, WASO, sleep duration, etc.).",
  },
  {
    source: "Part 2 day summary",
    description: "Daily activity summaries (L5/M5, MVPA).",
  },
  {
    source: "Part 2 person summary",
    description:
      "Recording-level metadata (device serial number, calibration error, measurement duration, etc.).",
  },
  {
    source: "Data quality report",
    description: "Calibration and file quality indicators.",
  },
  {
    source: "Epoch-level time series",
    description:
      "If Part 5 time series output was saved (the default), epoch-level data is nested within each day for fine-grained visualisation in the dashboard.",
  },
];

const EPOCH_FIELDS = [
  { field: "timenum", type: "INT64 / DOUBLE", description: "Unix timestamp (seconds since 1970-01-01)" },
  { field: "acc", type: "DOUBLE", description: "Acceleration metric for this epoch (typically ENMO in milli-gravity)" },
  { field: "class_id", type: "INT32", description: "Behavioral class code (see legend below)" },
  { field: "spt", type: "BOOLEAN", description: "TRUE if this epoch falls within the sleep period time" },
  { field: "invalid", type: "BOOLEAN", description: "TRUE if classified as invalid (non-wear, clipping, etc.)" },
  { field: "window", type: "INT32", description: "Window/day number this epoch belongs to" },
  { field: "anglez", type: "DOUBLE", description: "(optional) Arm angle relative to horizontal, in degrees" },
  { field: "lux", type: "DOUBLE", description: "(optional) Light intensity in lux" },
  { field: "temperature", type: "DOUBLE", description: "(optional) Skin/device temperature in Celsius" },
  { field: "steps", type: "INT32", description: "(optional) Step count for this epoch" },
];

const TROUBLESHOOTING = [
  {
    warning: '"No results directory found"',
    cause:
      "GGIR did not produce any output. Verify that outputdir is correct and that the pipeline completed without errors.",
  },
  {
    warning: '"No Part 5 day summary CSVs found"',
    cause:
      "Part 5 and its report have not been run. Ensure mode includes 5 and do.report includes 5.",
  },
  {
    warning: '"Part 5 day summary CSVs are empty"',
    cause:
      "Part 5 ran but produced no valid data rows. Check your input data and cleaning/inclusion thresholds.",
  },
  {
    warning: '"Consolidated data is empty"',
    cause:
      "The join across parts produced zero rows. This may indicate a mismatch in participant IDs or calendar dates across parts.",
  },
];

export default function DocsPage() {
  return (
    <div className={`${geistSans.className} font-sans`}>
      <Head>
        <title>Docs — Generating Parquet Files with GGIR</title>
        <meta
          name="description"
          content="Learn how to export GGIR results to Parquet format for use with the GGIR Dashboard."
        />
      </Head>

      <MainLayout>
        <div className="mx-auto max-w-6xl px-4 py-12">
          {/* Page header */}
          <div className="max-w-3xl space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              Generating Parquet Files with GGIR
            </h1>
            <p className="text-muted-foreground leading-relaxed">
              <a
                href="https://wadpac.github.io/GGIR/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                GGIR
              </a>{" "}
              can export its key output data to a single consolidated
              Apache Parquet file. This file is designed to be uploaded directly
              to the GGIR Dashboard, where you can interactively explore and
              visualise your study results without any additional coding or data
              processing.
            </p>
          </div>

          {/* Two-column layout: content + sidebar */}
          <div className="mt-10 flex gap-10">
            {/* Main content */}
            <div className="min-w-0 flex-1 space-y-12">
              {/* Prerequisites */}
              <Section id="prerequisites" title="Prerequisites">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  The <InlineCode>arrow</InlineCode> R package must be
                  installed. GGIR requires <strong>R &ge; 4.0</strong>.
                </p>
                <CodeBlock>{'install.packages("arrow")'}</CodeBlock>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  For full documentation on GGIR installation and configuration,
                  see the{" "}
                  <a
                    href="https://wadpac.github.io/GGIR/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    official GGIR documentation
                  </a>{" "}
                  and the{" "}
                  <a
                    href="https://cran.r-project.org/package=GGIR"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    CRAN package page
                  </a>
                  .
                </p>
              </Section>

              {/* How to enable */}
              <Section id="enable-export" title="How to Enable Parquet Export">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Set the parameter{" "}
                  <InlineCode>save_dashboard_parquet</InlineCode> to{" "}
                  <InlineCode>TRUE</InlineCode> in your{" "}
                  <InlineCode>GGIR()</InlineCode> call. The Parquet file is
                  generated automatically after all requested parts and reports
                  have completed.
                </p>
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    <strong>Important:</strong> All five parts (1–5) and the
                    reports for parts 2, 4, and 5 must have run successfully
                    before the export can produce meaningful output, because the
                    Parquet file consolidates data from across these reports.
                  </p>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  <InlineCode>save_dashboard_parquet</InlineCode> defaults to{" "}
                  <InlineCode>FALSE</InlineCode>. No Parquet file is generated
                  unless you explicitly set it to{" "}
                  <InlineCode>TRUE</InlineCode>.
                </p>
              </Section>

              {/* Code examples */}
              <Section id="examples" title="Code Examples">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">Minimal example</h3>
                    <CodeBlock>
                      {`library(GGIR)
GGIR(
  mode = 1:5,
  datadir = "C:/mystudy/mydata",
  outputdir = "C:/myresults",
  do.report = c(2, 4, 5),
  save_dashboard_parquet = TRUE
)`}
                    </CodeBlock>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">
                      Combined with other GGIR parameters
                    </h3>
                    <CodeBlock>
                      {`library(GGIR)
GGIR(
  mode = 1:5,
  datadir = "C:/mystudy/mydata",
  outputdir = "C:/myresults",
  studyname = "my_study",
  do.report = c(2, 4, 5),
  threshold.lig = 40,
  threshold.mod = 100,
  threshold.vig = 400,
  save_dashboard_parquet = TRUE
)`}
                    </CodeBlock>
                  </div>
                </div>
              </Section>

              {/* Output file */}
              <Section id="output-file" title="Output File">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  When enabled, the following file is created in the results
                  directory:
                </p>
                <CodeBlock>
                  {"<outputdir>/output_<studyname>/results/ggir_results.parquet"}
                </CodeBlock>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Replace{" "}
                  <InlineCode>{"<outputdir>"}</InlineCode> and{" "}
                  <InlineCode>{"<studyname>"}</InlineCode> with the values you
                  passed to <InlineCode>GGIR()</InlineCode>. If you did not set a{" "}
                  <InlineCode>studyname</InlineCode>, GGIR uses the input folder
                  name.
                </p>
              </Section>

              {/* Using with dashboard */}
              <Section id="using-with-dashboard" title="Using with the Dashboard">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Once GGIR has finished processing and the Parquet file has been
                  generated:
                </p>
                <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground leading-relaxed">
                  <li>
                    Navigate to the{" "}
                    <a href="/" className="text-primary hover:underline">
                      GGIR Dashboard
                    </a>
                    .
                  </li>
                  <li>
                    Upload your <InlineCode>ggir_results.parquet</InlineCode>{" "}
                    file.
                  </li>
                  <li>
                    The dashboard will automatically parse the file and present
                    interactive visualisations of your study data.
                  </li>
                </ol>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  No additional software, coding, or data manipulation is
                  required.
                </p>

                <div className="mt-4 space-y-2">
                  <h3 className="text-sm font-medium">Available Views</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    After uploading, you can explore your data across three pages:
                  </p>
                  <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                    <li>
                      <strong>Upload</strong> — Preview the raw data table,
                      inspect the column schema, and review embedded file
                      metadata.
                    </li>
                    <li>
                      <strong>Dashboard</strong> — Study-level charts organized
                      into Data Quality, Sleep Analysis, and Physical Activity
                      tabs. Tabs are automatically enabled based on the columns
                      present in your file.
                    </li>
                    <li>
                      <strong>Epoch Explorer</strong> — Participant-level,
                      day-by-day epoch time series. Requires the nested{" "}
                      <InlineCode>epochs</InlineCode> column (included by
                      default when Part 5 time series output is saved).
                    </li>
                  </ul>
                </div>
              </Section>

              {/* What the file contains */}
              <Section id="file-contents" title="What the Parquet File Contains">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  The Parquet file is a single consolidated table at the day level
                  (one row per participant per calendar day). It is built by
                  automatically joining data from multiple GGIR output parts:
                </p>
                <div className="overflow-x-auto rounded-lg border bg-card">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-3 text-left font-medium">Source</th>
                        <th className="p-3 text-left font-medium">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {PARQUET_SOURCES.map((row) => (
                        <tr key={row.source}>
                          <td className="p-3 font-medium whitespace-nowrap">
                            {row.source}
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {row.description}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  The file also carries embedded metadata such as the acceleration
                  thresholds used, the acceleration metric (e.g., ENMO), epoch
                  length, and a variable dictionary — all of which the dashboard
                  uses to correctly label and interpret your data.
                </p>
              </Section>

              {/* Database Schema & Developer Notes */}
              <Section id="developer-notes" title="Database Schema & Developer Notes">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  For users who want to query the Parquet file outside of this
                  dashboard (e.g., via Python, R, or native DuckDB), the file
                  uses a <strong>flat, day-level schema</strong> where each row
                  represents one participant per calendar day. The primary key
                  is{" "}
                  <InlineCode>(id, calendar_date)</InlineCode>.
                </p>

                {/* Epoch struct fields */}
                <div className="mt-4 space-y-2">
                  <h3 className="text-sm font-medium">
                    Nested <InlineCode>epochs</InlineCode> Column
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Each row&apos;s <InlineCode>epochs</InlineCode> field is
                    a <InlineCode>LIST of STRUCTS</InlineCode>. Each struct
                    represents one epoch (typically 5 seconds). The fields are:
                  </p>
                  <div className="overflow-x-auto rounded-lg border bg-card">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="p-3 text-left font-medium">Field</th>
                          <th className="p-3 text-left font-medium">Type</th>
                          <th className="p-3 text-left font-medium">Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {EPOCH_FIELDS.map((row) => (
                          <tr key={row.field}>
                            <td className="p-3 font-mono text-xs whitespace-nowrap">
                              {row.field}
                            </td>
                            <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                              {row.type}
                            </td>
                            <td className="p-3 text-muted-foreground">
                              {row.description}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Behavioral classes */}
                <div className="mt-4 space-y-2">
                  <h3 className="text-sm font-medium">Behavioral Classes</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    The <InlineCode>class_id</InlineCode> maps to behavioral
                    classes. The exact mapping is stored as JSON in the{" "}
                    <InlineCode>behavioral_codes</InlineCode> Parquet metadata
                    key. A standard mapping is:
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    <li><SmallCode>0</SmallCode> = Inactive during waking (IN)</li>
                    <li><SmallCode>1</SmallCode> = Light physical activity (LIG)</li>
                    <li><SmallCode>2</SmallCode> = Moderate physical activity (MOD)</li>
                    <li><SmallCode>3</SmallCode> = Vigorous physical activity (VIG)</li>
                    <li><SmallCode>4</SmallCode> = Sleep during SPT</li>
                    <li><SmallCode>5–8</SmallCode> = Awake during SPT at various intensities</li>
                  </ul>
                </div>

                {/* Query examples */}
                <div className="mt-4 space-y-4">
                  <h3 className="text-sm font-medium">Query Examples (DuckDB)</h3>

                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Day-level summary with non-wear filter:</p>
                    <CodeBlock>
{`SELECT id, calendar_date, weekday,
       dur_day_total_mod_min + dur_day_total_vig_min AS mvpa_min,
       dur_spt_sleep_min, sleep_efficiency_after_onset
FROM ggir
WHERE nonwear_perc_day_spt < 25;`}
                    </CodeBlock>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Flatten epochs for a specific day:</p>
                    <CodeBlock>
{`SELECT g.id, g.calendar_date, e.*
FROM ggir g, UNNEST(g.epochs) AS e
WHERE g.id = 'participant_001'
  AND g.calendar_date = '2024-03-15';`}
                    </CodeBlock>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Read file metadata:</p>
                    <CodeBlock>
{`SELECT * FROM parquet_kv_metadata('ggir_results.parquet');`}
                    </CodeBlock>
                  </div>
                </div>
              </Section>

              {/* Privacy and Data Security */}
              <Section id="privacy" title="Privacy & Data Security">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  This dashboard is designed with researcher data privacy as
                  a core principle. It uses{" "}
                  <strong>DuckDB-WASM</strong> to query and process your data
                  entirely within your browser.
                </p>
                <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
                  <p className="text-sm text-primary dark:text-primary/90">
                    <strong>No data leaves your machine.</strong> Your Parquet
                    file is processed locally in your browser&apos;s memory
                    and is never transmitted to any server.
                  </p>
                </div>
                <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                  <li>
                    <strong>File reading</strong> — your file is read directly
                    into browser memory via the File API; no upload occurs.
                  </li>
                  <li>
                    <strong>SQL queries</strong> — all DuckDB queries execute
                    inside a WebAssembly sandbox in your browser tab.
                  </li>
                  <li>
                    <strong>Visualizations</strong> — every chart is rendered
                    client-side; no server-side rendering or data relay.
                  </li>
                  <li>
                    <strong>No analytics on your data</strong> — the app does not
                    send your participant data to any analytics or tracking
                    service.
                  </li>
                  <li>
                    <strong>Works offline</strong> — after the initial page load,
                    the dashboard functions fully without an internet connection.
                    You can verify this by disconnecting after the page loads.
                  </li>
                </ul>
              </Section>

              {/* Troubleshooting */}
              <Section id="troubleshooting" title="Troubleshooting">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  If the Parquet file is not created after your GGIR run completes,
                  check the R console for the following warning messages:
                </p>
                <div className="overflow-x-auto rounded-lg border bg-card">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-3 text-left font-medium">Warning</th>
                        <th className="p-3 text-left font-medium">Cause</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {TROUBLESHOOTING.map((row) => (
                        <tr key={row.warning}>
                          <td className="p-3 font-mono text-xs whitespace-nowrap">
                            {row.warning}
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {row.cause}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            </div>

            {/* Sidebar — hidden on small screens */}
            <aside className="hidden lg:block w-56 shrink-0">
              <nav className="sticky top-20 rounded-lg border bg-card p-4">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  On this page
                </h2>
                <ul className="mt-3 flex flex-col gap-1.5">
                  {TABLE_OF_CONTENTS.map((item) => (
                    <li key={item.id}>
                      <a
                        href={`#${item.id}`}
                        className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </aside>
          </div>
        </div>
      </MainLayout>
    </div>
  );
}
