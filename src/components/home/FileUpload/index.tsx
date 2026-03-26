import { useCallback, useState, useRef } from "react";
import { useRouter } from "next/router";
import { Upload, FileUp, X, Loader2, BookOpen, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { queryParquet, type QueryResult } from "@/lib/duckdb";

type FileUploadProps = {
  onFileRead?: (data: QueryResult) => void;
};

export function FileUpload({ onFileRead }: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSampleLoading, setIsSampleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setError(null);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith(".parquet")) {
      setFile(droppedFile);
    }
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        setFile(selectedFile);
        setError(null);
      }
    },
    []
  );

  const handleRemoveFile = useCallback(() => {
    setFile(null);
    setError(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, []);

  const handleReadFile = useCallback(async () => {
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await queryParquet(file);
      onFileRead?.(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to read parquet file"
      );
    } finally {
      setIsLoading(false);
    }
  }, [file, onFileRead]);

  const handleTrySample = useCallback(async () => {
    setIsSampleLoading(true);
    setError(null);

    try {
      const basePath = router.basePath || "";
      const res = await fetch(`${basePath}/sample_data/ggir_results.parquet`);
      if (!res.ok) throw new Error("Failed to fetch sample data");
      const blob = await res.blob();
      const sampleFile = new File([blob], "ggir_results.parquet", {
        type: "application/octet-stream",
      });
      const result = await queryParquet(sampleFile);
      setFile(sampleFile);
      onFileRead?.(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load sample data"
      );
    } finally {
      setIsSampleLoading(false);
    }
  }, [onFileRead, router.basePath]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const anyLoading = isLoading || isSampleLoading;

  return (
    <div className="w-full max-w-xl mx-auto">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          relative flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-12 cursor-pointer transition-colors
          ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/50"
          }
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".parquet"
          onChange={handleFileSelect}
          className="hidden"
        />
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Upload className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">
            Drag & drop your parquet file here
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            or click to browse — accepts .parquet files
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center">
        <Button
          variant="outline"
          size="sm"
          onClick={handleTrySample}
          disabled={anyLoading}
          className="text-xs"
        >
          {isSampleLoading ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <FlaskConical className="mr-1.5 h-3.5 w-3.5" />
          )}
          {isSampleLoading ? "Loading sample…" : "Try with sample data"}
        </Button>
      </div>

      {file && (
        <div className="mt-4 flex items-center justify-between rounded-lg border bg-card p-4">
          <div className="flex items-center gap-3">
            <FileUp className="h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-medium truncate max-w-[280px]">
                {file.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(file.size)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="default"
              size="sm"
              onClick={handleReadFile}
              disabled={anyLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <BookOpen className="h-4 w-4" />
              )}
              {isLoading ? "Reading..." : "Read File"}
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={handleRemoveFile}
              disabled={anyLoading}
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-2 text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}

