import { lazy, memo, Suspense, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useResolvedTheme } from "@/hooks/useTheme";
import { getMonacoLanguageFromPath, disableMonacoDiagnostics } from "@/lib/monaco";
import { captureException } from "@/lib/analytics/analytics";

const MonacoEditor = lazy(() =>
  import("@monaco-editor/react").then((mod) => ({ default: mod.default })),
);
const PdfRenderer = lazy(() => import("./PdfRenderer"));
const DocxRenderer = lazy(() => import("./DocxRenderer"));
const XlsxRenderer = lazy(() => import("./XlsxRenderer"));
const PptxRenderer = lazy(() => import("./PptxRenderer"));

// ── File-type routing ──

const IMAGE_MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
  webp: "image/webp", svg: "image/svg+xml", bmp: "image/bmp", ico: "image/x-icon", avif: "image/avif",
};
const DOCX_EXTS = new Set(["docx"]);
const XLSX_EXTS = new Set(["xlsx", "xls", "ods"]);
const PPTX_EXTS = new Set(["pptx"]);

export type PreviewKind = "image" | "pdf" | "docx" | "xlsx" | "pptx" | "text";

export function previewKind(filePath: string): PreviewKind {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  if (ext in IMAGE_MIME) return "image";
  if (ext === "pdf") return "pdf";
  if (DOCX_EXTS.has(ext)) return "docx";
  if (XLSX_EXTS.has(ext)) return "xlsx";
  if (PPTX_EXTS.has(ext)) return "pptx";
  return "text";
}

function base64ToBytes(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

function base64ToObjectUrl(base64: string, mime: string): string {
  return URL.createObjectURL(new Blob([base64ToBytes(base64) as BlobPart], { type: mime }));
}

const Centered = ({ children }: { children: React.ReactNode }) => (
  <div className="flex h-full items-center justify-center p-6">{children}</div>
);

/**
 * Renders a file's content by type — images, PDF (pdf.js), Office documents
 * (docx-preview / SheetJS / pptxviewjs), or text/code (Monaco). Fills its
 * container; the surrounding chrome (modal or panel) is the caller's.
 */
export const FilePreviewContent = memo(function FilePreviewContent({ filePath }: { filePath: string }) {
  const [content, setContent] = useState<string | null>(null);
  const [binaryUrl, setBinaryUrl] = useState<string | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const resolvedTheme = useResolvedTheme();

  const kind = useMemo(() => previewKind(filePath), [filePath]);
  const fileName = filePath.split("/").pop() ?? filePath;

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setLoading(true);
    setError(null);
    setContent(null);
    setBinaryUrl(null);
    setBytes(null);

    const run = async () => {
      if (kind === "text") {
        const res = await window.claude.readFile(filePath);
        if (cancelled) return;
        if (res.error) setError(res.error);
        else setContent(res.content ?? "");
        return;
      }
      const res = await window.claude.readFileBinary(filePath);
      if (cancelled) return;
      if (res.error || !res.base64) { setError(res.error ?? "Failed to read file"); return; }
      if (kind === "image") {
        const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
        objectUrl = base64ToObjectUrl(res.base64, IMAGE_MIME[ext] ?? "application/octet-stream");
        setBinaryUrl(objectUrl);
        return;
      }
      setBytes(base64ToBytes(res.base64));
    };

    run()
      .catch((err) => {
        if (cancelled) return;
        captureException(err instanceof Error ? err : new Error(String(err)), { label: "FILE_PREVIEW_ERR" });
        setError(err instanceof Error ? err.message : "Failed to preview file");
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [filePath, kind]);

  const spinner = (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
    </div>
  );

  if (loading) return spinner;
  if (error) return <Centered><p className="max-w-md text-center text-sm text-muted-foreground/70 whitespace-pre-wrap">{error}</p></Centered>;

  if (bytes && (kind === "pdf" || kind === "docx" || kind === "xlsx" || kind === "pptx")) {
    return (
      <Suspense fallback={spinner}>
        {kind === "pdf" && <PdfRenderer bytes={bytes} />}
        {kind === "docx" && <DocxRenderer bytes={bytes} />}
        {kind === "xlsx" && <XlsxRenderer bytes={bytes} />}
        {kind === "pptx" && <PptxRenderer bytes={bytes} />}
      </Suspense>
    );
  }

  if (binaryUrl && kind === "image") {
    return (
      <div className="flex h-full items-center justify-center overflow-auto bg-[repeating-conic-gradient(#00000008_0_25%,transparent_0_50%)] bg-[length:20px_20px] p-4">
        <img src={binaryUrl} alt={fileName} className="max-h-full max-w-full object-contain" />
      </div>
    );
  }

  if (content !== null && kind === "text") {
    return (
      <Suspense fallback={spinner}>
        <MonacoEditor
          height="100%"
          language={getMonacoLanguageFromPath(filePath)}
          value={content}
          theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
          beforeMount={disableMonacoDiagnostics}
          options={{
            readOnly: true,
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            fontSize: 13,
            lineNumbers: "on",
            wordWrap: "on",
            automaticLayout: true,
            domReadOnly: true,
            renderLineHighlight: "none",
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
            padding: { top: 8, bottom: 8 },
          }}
          loading={spinner}
        />
      </Suspense>
    );
  }

  return spinner;
});
