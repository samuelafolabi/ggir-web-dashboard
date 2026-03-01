import { useCallback, useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/router";
import { Geist, Geist_Mono } from "next/font/google";
import { ArrowRight, ChevronLeft, ChevronRight, Search } from "lucide-react";
import MainLayout from "@/components/MainLayout";
import { FileUpload } from "@/components/home/FileUpload";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { useData } from "@/context/DataContext";
import type { QueryResult } from "@/lib/duckdb";
import { formatDate } from "@/lib/ggir";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const COLS_PER_PAGE = 8;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatCellValue(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number") {
    if (Number.isInteger(value)) return value.toLocaleString();
    return value.toFixed(4);
  }
  const s = String(value);
  const asNum = Number(s);
  if (!isNaN(asNum) && s.length >= 13 && asNum > 1e12 && asNum < 2e13) {
    return formatDate(value) || s;
  }
  return s;
}

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
    </div>
  );
}

export default function Home() {
  const { data, setData } = useData();
  const router = useRouter();
  const [localResult, setLocalResult] = useState<QueryResult | null>(null);
  const [colPage, setColPage] = useState(0);
  const [dataSearch, setDataSearch] = useState("");
  const [schemaSearch, setSchemaSearch] = useState("");
  const [metaSearch, setMetaSearch] = useState("");
  const tableRef = useRef<HTMLDivElement>(null);

  const result = localResult ?? data;

  const handleFileRead = useCallback(
    (r: QueryResult) => {
      setData(r);
      setLocalResult(r);
      setColPage(0);
      setDataSearch("");
      setSchemaSearch("");
      setMetaSearch("");
    },
    [setData]
  );

  useEffect(() => {
    if (localResult && tableRef.current) {
      tableRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [localResult]);

  const totalCols = result?.columns.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCols / COLS_PER_PAGE));
  const visibleCols = useMemo(() => {
    if (!result) return [];
    const start = colPage * COLS_PER_PAGE;
    return result.columns.slice(start, start + COLS_PER_PAGE);
  }, [result, colPage]);

  const filteredDataRows = useMemo(() => {
    if (!result) return [];
    const q = dataSearch.toLowerCase().trim();
    if (!q) return result.rows;
    return result.rows.filter((row) =>
      visibleCols.some((col) => formatCellValue(row[col]).toLowerCase().includes(q))
    );
  }, [result, dataSearch, visibleCols]);

  const filteredSchema = useMemo(() => {
    if (!result) return [];
    const q = schemaSearch.toLowerCase().trim();
    if (!q) return result.metadata.schema;
    return result.metadata.schema.filter(
      (f) => f.name.toLowerCase().includes(q) || f.type.toLowerCase().includes(q)
    );
  }, [result, schemaSearch]);

  const metaFixedRows = useMemo(() => {
    if (!result) return [];
    const rows: { key: string; value: string }[] = [
      { key: "File Name", value: result.metadata.fileName },
      { key: "File Size", value: formatFileSize(result.metadata.fileSizeBytes) },
      { key: "Total Rows", value: result.metadata.numRows.toLocaleString() },
      { key: "Total Columns", value: String(result.metadata.numColumns) },
      { key: "Row Groups", value: String(result.metadata.numRowGroups) },
    ];
    if (result.metadata.createdBy) {
      rows.push({ key: "Created By", value: result.metadata.createdBy });
    }
    return rows;
  }, [result]);

  const metaKvRows = useMemo(() => {
    if (!result) return [];
    return Object.entries(result.metadata.keyValueMetadata).map(([k, v]) => ({
      key: k,
      value: v,
    }));
  }, [result]);

  const filteredMetaRows = useMemo(() => {
    const q = metaSearch.toLowerCase().trim();
    const all = [...metaFixedRows, ...metaKvRows];
    if (!q) return all;
    return all.filter(
      (r) => r.key.toLowerCase().includes(q) || r.value.toLowerCase().includes(q)
    );
  }, [metaFixedRows, metaKvRows, metaSearch]);

  return (
    <div
      className={`${geistSans.className} ${geistMono.className} font-sans`}
    >
      <MainLayout>
        <div className="mx-auto max-w-5xl px-4 py-12 space-y-10">
          <div className="flex flex-col items-center gap-8">
            <div className="text-center">
              <h1 className="text-3xl font-semibold tracking-tight">
                Upload GGIR Output
              </h1>
              <p className="mt-2 text-muted-foreground">
                Upload your GGIR parquet file to get started.
              </p>
            </div>
            <FileUpload onFileRead={handleFileRead} />
          </div>

          {result && (
            <div ref={tableRef} className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {result.metadata.numRows.toLocaleString()} rows ·{" "}
                    {result.metadata.numColumns} columns
                  </p>
                </div>
                <div className="flex gap-2">

                <Button onClick={() => router.push("/visualization")}>
                  Open Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button onClick={() => router.push("/epoch-explorer")}>
                  Open Epoch Explorer
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                </div>
              </div>

              <Tabs defaultValue="data">
                <TabsList>
                  <TabsTrigger value="data">Data Preview</TabsTrigger>
                  <TabsTrigger value="schema">Schema</TabsTrigger>
                  <TabsTrigger value="metadata">Metadata</TabsTrigger>
                </TabsList>

                <TabsContent value="data" className="space-y-3 mt-3">
                  <SearchInput value={dataSearch} onChange={setDataSearch} placeholder="Search visible columns…" />
                  <div className="rounded-lg border bg-card">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10 text-center text-muted-foreground">
                            #
                          </TableHead>
                          {visibleCols.map((col) => (
                            <TableHead key={col}>{col}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredDataRows.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={visibleCols.length + 1} className="text-center text-sm text-muted-foreground py-6">
                              No matching rows
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredDataRows.map((row, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-center text-xs text-muted-foreground">
                                {i + 1}
                              </TableCell>
                              {visibleCols.map((col) => (
                                <TableCell key={col} className="max-w-[200px] truncate text-xs">
                                  {formatCellValue(row[col])}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>
                        Columns {colPage * COLS_PER_PAGE + 1}–
                        {Math.min((colPage + 1) * COLS_PER_PAGE, totalCols)} of{" "}
                        {totalCols}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={colPage === 0}
                          onClick={() => setColPage((p) => p - 1)}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="px-2">
                          {colPage + 1} / {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={colPage >= totalPages - 1}
                          onClick={() => setColPage((p) => p + 1)}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="schema" className="mt-3 space-y-3">
                  <SearchInput value={schemaSearch} onChange={setSchemaSearch} placeholder="Search columns by name or type…" />
                  <div className="rounded-lg border bg-card">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12 text-center text-muted-foreground">
                            #
                          </TableHead>
                          <TableHead>Column Name</TableHead>
                          <TableHead>Type</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSchema.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">
                              No matching columns
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredSchema.map((field, i) => (
                            <TableRow key={field.name}>
                              <TableCell className="text-center text-xs text-muted-foreground">
                                {i + 1}
                              </TableCell>
                              <TableCell className="text-sm font-mono max-w-[180px] truncate">
                                {field.name}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground text-right pr-4">
                                {field.type}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {filteredSchema.length === result.metadata.schema.length
                      ? `${result.metadata.schema.length} columns`
                      : `${filteredSchema.length} of ${result.metadata.schema.length} columns`}
                  </p>
                </TabsContent>

                <TabsContent value="metadata" className="mt-3 space-y-3">
                  <SearchInput value={metaSearch} onChange={setMetaSearch} placeholder="Search metadata…" />
                  <div className="rounded-lg border bg-card">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Property</TableHead>
                          <TableHead>Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredMetaRows.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={2} className="text-center text-sm text-muted-foreground py-6">
                              No matching entries
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredMetaRows.map((r) => (
                            <TableRow key={r.key}>
                              <TableCell className="text-sm font-medium">{r.key}</TableCell>
                              <TableCell className="text-sm max-w-md truncate">{r.value}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {filteredMetaRows.length === metaFixedRows.length + metaKvRows.length
                      ? `${metaFixedRows.length + metaKvRows.length} entries`
                      : `${filteredMetaRows.length} of ${metaFixedRows.length + metaKvRows.length} entries`}
                  </p>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </MainLayout>
    </div>
  );
}
