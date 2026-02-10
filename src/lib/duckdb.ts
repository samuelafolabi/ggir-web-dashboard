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

export type QueryResult = {
  columns: string[];
  rows: Record<string, unknown>[];
};

export async function queryParquet(file: File): Promise<QueryResult> {
  const instance = await initDuckDB();
  const conn = await instance.connect();

  try {
    const buffer = new Uint8Array(await file.arrayBuffer());
    await instance.registerFileBuffer(file.name, buffer);

    const result = await conn.query(
      `SELECT * FROM '${file.name}' LIMIT 100`
    );

    const columns = result.schema.fields.map((f) => f.name);
    const rows: Record<string, unknown>[] = [];

    for (let i = 0; i < result.numRows; i++) {
      const row: Record<string, unknown> = {};
      for (const col of columns) {
        const value = result.getChildAt(columns.indexOf(col))?.get(i);
        row[col] = value;
      }
      rows.push(row);
    }

    return { columns, rows };
  } finally {
    await conn.close();
  }
}
