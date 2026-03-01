import * as duckdb from "@duckdb/duckdb-wasm";

let db: duckdb.AsyncDuckDB | null = null;

const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();

export async function initDuckDB(): Promise<duckdb.AsyncDuckDB> {
  if (db) return db;

  const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

  // Create worker via Blob URL to avoid cross-origin restriction on CDN scripts.
  // Classic workers can use importScripts() to load cross-origin scripts freely.
  const workerUrl = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker!}");`], {
      type: "text/javascript",
    })
  );
  const worker = new Worker(workerUrl);
  const logger = new duckdb.ConsoleLogger();
  db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

  return db;
}

export type ParquetSchemaField = {
  name: string;
  type: string;
};

export type ParquetMetadata = {
  fileName: string;
  fileSizeBytes: number;
  numRows: number;
  numColumns: number;
  numRowGroups: number;
  createdBy: string | null;
  schema: ParquetSchemaField[];
  keyValueMetadata: Record<string, string>;
};

export type QueryResult = {
  columns: string[];
  rows: Record<string, unknown>[];
  metadata: ParquetMetadata;
};

/** Helper to extract rows from an Arrow result table */
function arrowToRows(result: { schema: { fields: { name: string }[] }; numRows: number; getChildAt: (i: number) => { get: (i: number) => unknown } | null }): Record<string, unknown>[] {
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

export async function queryParquet(file: File): Promise<QueryResult> {
  const instance = await initDuckDB();
  const conn = await instance.connect();

  try {
    const buffer = new Uint8Array(await file.arrayBuffer());
    await instance.registerFileBuffer(file.name, buffer);

    // --- Data query ---
    const result = await conn.query(
      `SELECT * FROM '${file.name}' LIMIT 10000`
    );
    const columns = result.schema.fields.map((f) => f.name);
    const rows = arrowToRows(result);

    // --- File-level metadata ---
    const metaResult = await conn.query(
      `SELECT * FROM parquet_metadata('${file.name}')`
    );
    const metaRows = arrowToRows(metaResult);
    const numRowGroups = metaRows.length;
    const totalRows = metaRows.reduce(
      (sum, r) => sum + (r.num_rows != null ? Number(r.num_rows) : 0),
      0
    );

    // --- Schema ---
    const schemaResult = await conn.query(
      `SELECT name, type FROM parquet_schema('${file.name}') WHERE name != 'duckdb_schema'`
    );
    const schemaRows = arrowToRows(schemaResult);
    const schema: ParquetSchemaField[] = schemaRows.map((r) => ({
      name: String(r.name ?? ""),
      type: String(r.type ?? ""),
    }));

    // --- Key-value metadata ---
    const keyValueMetadata: Record<string, string> = {};
    try {
      const kvResult = await conn.query(
        `SELECT key, value FROM parquet_kv_metadata('${file.name}')`
      );
      const kvRows = arrowToRows(kvResult);
      const decoder = new TextDecoder();
      for (const kv of kvRows) {
        if (kv.key != null) {
          const key = kv.key instanceof Uint8Array ? decoder.decode(kv.key) : String(kv.key);
          const val = kv.value instanceof Uint8Array ? decoder.decode(kv.value) : String(kv.value ?? "");
          keyValueMetadata[key] = val;
        }
      }
    } catch {
      // parquet_kv_metadata may not exist for all files — ignore
    }

    const metadata: ParquetMetadata = {
      fileName: file.name,
      fileSizeBytes: file.size,
      numRows: totalRows,
      numColumns: columns.length,
      numRowGroups,
      createdBy: (metaRows[0]?.created_by as string) ?? null,
      schema,
      keyValueMetadata,
    };

    return { columns, rows, metadata };
  } finally {
    await conn.close();
  }
}
