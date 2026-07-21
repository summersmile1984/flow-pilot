import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, File, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { OpenInEditorButton } from "./OpenInEditorButton";
import { useResolvedTheme } from "@/hooks/useTheme";
import { getLanguageFromPath } from "@/lib/languages";
import { getMonacoLanguageFromPath, disableMonacoDiagnostics } from "@/lib/monaco";
import { captureException } from "@/lib/analytics/analytics";

const MonacoEditor = lazy(() =>
  import("@monaco-editor/react").then((mod) => ({ default: mod.default })),
);
const PdfRenderer = lazy(() => import("./preview/PdfRenderer"));
const DocxRenderer = lazy(() => import("./preview/DocxRenderer"));
const XlsxRenderer = lazy(() => import("./preview/XlsxRenderer"));
const PptxRenderer = lazy(() => import("./preview/PptxRenderer"));

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── File-type routing ──

const IMAGE_MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
  webp: "image/webp", svg: "image/svg+xml", bmp: "image/bmp", ico: "image/x-icon", avif: "image/avif",
};
// Office formats rendered natively by dedicated JS libraries (csv stays text —
// Monaco reads it fine). .doc/.ppt (legacy binary) have no JS renderer.
const DOCX_EXTS = new Set(["docx"]);
const XLSX_EXTS = new Set(["xlsx", "xls", "ods"]);
const PPTX_EXTS = new Set(["pptx"]);

type PreviewKind = "image" | "pdf" | "docx" | "xlsx" | "pptx" | "text";

function previewKind(filePath: string): PreviewKind {
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

// ── Props ──

interface FilePreviewOverlayProps {
  filePath: string | null;
  sourceRect: DOMRect | null;
  onClose: () => void;
}

// ── Overlay dimensions ──

const OVERLAY_WIDTH = 800;
const OVERLAY_MAX_HEIGHT_VH = 85;

// ── Component ──

export const FilePreviewOverlay = memo(function FilePreviewOverlay({
  filePath,
  sourceRect,
  onClose,
}: FilePreviewOverlayProps) {
  return (
    <AnimatePresence mode="wait">
      {filePath && (
        <OverlayContent
          key={filePath}
          filePath={filePath}
          sourceRect={sourceRect}
          onClose={onClose}
        />
      )}
    </AnimatePresence>
  );
});

// ── Inner content (separate for AnimatePresence keying) ──

interface OverlayContentProps {
  filePath: string;
  sourceRect: DOMRect | null;
  onClose: () => void;
}

const OverlayContent = memo(function OverlayContent({
  filePath,
  sourceRect,
  onClose,
}: OverlayContentProps) {
  const [content, setContent] = useState<string | null>(null);
  const [binaryUrl, setBinaryUrl] = useState<string | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [binarySize, setBinarySize] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const resolvedTheme = useResolvedTheme();

  const kind = useMemo(() => previewKind(filePath), [filePath]);

  // Load by type: text via readFile, images as an object URL, and documents
  // (pdf/docx/xlsx/pptx) as raw bytes handed to native JS renderers.
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setLoading(true);
    setError(null);
    setContent(null);
    setBinaryUrl(null);
    setBytes(null);
    setBinarySize(null);

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
      setBinarySize(res.size ?? null);
      if (kind === "image") {
        const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
        objectUrl = base64ToObjectUrl(res.base64, IMAGE_MIME[ext] ?? "application/octet-stream");
        setBinaryUrl(objectUrl);
        return;
      }
      // pdf / docx / xlsx / pptx — hand raw bytes to the native renderer
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

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [onClose]);

  // Compute FLIP transform from source rect
  const flipTransform = useMemo(() => {
    if (!sourceRect) return null;

    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const overlayW = Math.min(OVERLAY_WIDTH, viewportW - 48);
    const overlayH = Math.min(
      viewportH * (OVERLAY_MAX_HEIGHT_VH / 100),
      viewportH - 48,
    );

    // Source center offset from viewport center (overlay's final position)
    const sourceX = sourceRect.left + sourceRect.width / 2;
    const sourceY = sourceRect.top + sourceRect.height / 2;

    return {
      x: sourceX - viewportW / 2,
      y: sourceY - viewportH / 2,
      scaleX: Math.max(sourceRect.width / overlayW, 0.02),
      scaleY: Math.max(sourceRect.height / overlayH, 0.02),
    };
  }, [sourceRect]);

  // File metadata
  const fileName = filePath.split("/").pop() ?? filePath;
  const dirPath = filePath.split("/").slice(0, -1).join("/");
  const language = getLanguageFromPath(filePath);
  const monacoLang = getMonacoLanguageFromPath(filePath);
  const lineCount = content ? content.split("\n").length : 0;
  const fileSize = content ? formatFileSize(new Blob([content]).size) : "";

  const morphTransform = flipTransform
    ? { x: flipTransform.x, y: flipTransform.y, scaleX: flipTransform.scaleX, scaleY: flipTransform.scaleY, opacity: 0 }
    : { scale: 0.92, opacity: 0 };

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 z-50 bg-black/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={handleBackdropClick}
      />

      {/* Morphing overlay card */}
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
        onClick={handleBackdropClick}
      >
        <motion.div
          className="pointer-events-auto flex flex-col overflow-hidden rounded-xl border border-foreground/10 bg-background shadow-2xl"
          style={{
            width: Math.min(OVERLAY_WIDTH, window.innerWidth - 48),
            height: `${OVERLAY_MAX_HEIGHT_VH}vh`,
          }}
          initial={morphTransform}
          animate={{ x: 0, y: 0, scaleX: 1, scaleY: 1, scale: 1, opacity: 1 }}
          exit={morphTransform}
          transition={{
            type: "spring",
            damping: 32,
            stiffness: 380,
            mass: 0.8,
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-foreground/[0.08] px-4 py-2.5">
            <File className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <span className="text-sm font-medium text-foreground">{fileName}</span>
              <span className="ms-2 truncate text-xs text-muted-foreground/60">{dirPath}</span>
            </div>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <OpenInEditorButton filePath={filePath} className="!text-muted-foreground/40 hover:!text-muted-foreground" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={4}>
                  <p className="text-xs">Open in editor</p>
                </TooltipContent>
              </Tooltip>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md
                  text-muted-foreground/40 transition-colors duration-150
                  hover:text-foreground hover:bg-foreground/[0.06]
                  active:scale-90"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Editor content */}
          <div className="relative flex-1 overflow-hidden" style={{ minHeight: 300 }}>
            {loading && (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
              </div>
            )}

            {error && (
              <div className="flex h-full items-center justify-center p-6">
                <p className="max-w-md text-center text-sm text-muted-foreground/70 whitespace-pre-wrap">{error}</p>
              </div>
            )}

            {/* Documents rendered natively by dedicated JS libraries */}
            {bytes && !loading && !error && (kind === "pdf" || kind === "docx" || kind === "xlsx" || kind === "pptx") && (
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
                  </div>
                }
              >
                {kind === "pdf" && <PdfRenderer bytes={bytes} />}
                {kind === "docx" && <DocxRenderer bytes={bytes} />}
                {kind === "xlsx" && <XlsxRenderer bytes={bytes} />}
                {kind === "pptx" && <PptxRenderer bytes={bytes} />}
              </Suspense>
            )}

            {/* Image */}
            {binaryUrl && !loading && kind === "image" && (
              <div className="flex h-full items-center justify-center overflow-auto bg-[repeating-conic-gradient(#00000008_0_25%,transparent_0_50%)] bg-[length:20px_20px] p-4">
                <img src={binaryUrl} alt={fileName} className="max-h-full max-w-full object-contain" />
              </div>
            )}

            {/* Text / code via Monaco */}
            {content !== null && !loading && kind === "text" && (
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
                  </div>
                }
              >
                <MonacoEditor
                  height="100%"
                  language={monacoLang}
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
                    scrollbar: {
                      verticalScrollbarSize: 8,
                      horizontalScrollbarSize: 8,
                    },
                    padding: { top: 8, bottom: 8 },
                  }}
                  loading={
                    <div className="flex h-full items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
                    </div>
                  }
                />
              </Suspense>
            )}
          </div>

          {/* Footer */}
          {content !== null && !loading && kind === "text" && (
            <div className="flex items-center gap-3 border-t border-foreground/[0.08] px-4 py-1.5">
              <span className="text-[11px] text-muted-foreground/50">
                {lineCount} {lineCount === 1 ? "line" : "lines"}
              </span>
              <span className="text-[11px] text-muted-foreground/30">•</span>
              <span className="text-[11px] text-muted-foreground/50">{language}</span>
              <span className="text-[11px] text-muted-foreground/30">•</span>
              <span className="text-[11px] text-muted-foreground/50">{fileSize}</span>
            </div>
          )}
          {(binaryUrl !== null || bytes !== null) && !loading && kind !== "text" && (
            <div className="flex items-center gap-3 border-t border-foreground/[0.08] px-4 py-1.5">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground/50">
                {kind === "docx" ? "Word" : kind === "xlsx" ? "Spreadsheet" : kind === "pptx" ? "Presentation" : kind === "pdf" ? "PDF" : "Image"}
              </span>
              {binarySize !== null && (
                <>
                  <span className="text-[11px] text-muted-foreground/30">•</span>
                  <span className="text-[11px] text-muted-foreground/50">{formatFileSize(binarySize)}</span>
                </>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </>
  );
});
