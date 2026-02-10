import { useState } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import MainLayout from "@/components/MainLayout";
import { FileUpload } from "@/components/home/FileUpload";
import { DataPreview } from "@/components/home/DataPreview";
import type { QueryResult } from "@/lib/duckdb";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function Home() {
  const [data, setData] = useState<QueryResult | null>(null);

  return (
    <div
      className={`${geistSans.className} ${geistMono.className} font-sans`}
    >
      <MainLayout>
        <div className="mx-auto max-w-5xl px-4 py-12">
          <div className="flex flex-col items-center gap-8">
            <div className="text-center">
              <h1 className="text-3xl font-semibold tracking-tight">
                Upload GGIR Output
              </h1>
              <p className="mt-2 text-muted-foreground">
                Upload your GGIR parquet file to get started.
              </p>
            </div>
            <FileUpload onFileRead={setData} />
          </div>

          {data && (
            <div className="mt-12">
              <DataPreview data={data} />
            </div>
          )}
        </div>
      </MainLayout>
    </div>
  );
}
