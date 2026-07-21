import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

/** Render a PDF's pages to canvases via pdf.js — fully in-app, theme-neutral. */
export default function PdfRenderer({ bytes }: { bytes: Uint8Array }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    type PdfDoc = { numPages: number; getPage: (n: number) => Promise<unknown>; destroy: () => void };
    let doc: PdfDoc | null = null;

    (async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).href;
      // pdf.js detaches the buffer it's given — hand it a copy so the source
      // bytes stay usable.
      const task = pdfjs.getDocument({ data: bytes.slice() });
      doc = (await task.promise) as unknown as PdfDoc;
      if (cancelled || !doc) return;
      const container = containerRef.current;
      if (!container) return;
      container.innerHTML = "";
      const scale = Math.min(2, (window.devicePixelRatio || 1) * 1.3);
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i) as {
          getViewport: (o: { scale: number }) => { width: number; height: number };
          render: (o: unknown) => { promise: Promise<void> };
        };
        if (cancelled) return;
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / scale}px`;
        canvas.className = "mx-auto mb-3 max-w-full rounded-sm shadow-md ring-1 ring-black/5";
        container.appendChild(canvas);
        await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
      }
      if (!cancelled) setLoading(false);
    })().catch((e) => {
      if (!cancelled) { setError(e instanceof Error ? e.message : String(e)); setLoading(false); }
    });

    return () => { cancelled = true; doc?.destroy?.(); };
  }, [bytes]);

  return (
    <div className="relative h-full overflow-auto bg-foreground/[0.03] p-4">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <p className="text-center text-sm text-muted-foreground/70">{error}</p>
        </div>
      )}
      <div ref={containerRef} />
    </div>
  );
}
