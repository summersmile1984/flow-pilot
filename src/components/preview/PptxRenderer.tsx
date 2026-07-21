import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";

interface Viewer {
  loadFile: (input: ArrayBuffer | Uint8Array) => Promise<unknown>;
  getSlideCount: () => number;
  goToSlide: (i: number, canvas?: HTMLCanvasElement | null) => Promise<unknown>;
}

/** Render .pptx slides to canvas via pptxviewjs, with prev/next navigation. */
export default function PptxRenderer({ bytes }: { bytes: Uint8Array }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const [slide, setSlide] = useState(0);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mod = await import("pptxviewjs");
      const PPTXViewer = (mod as { PPTXViewer: new (o: unknown) => Viewer }).PPTXViewer;
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;
      const viewer = new PPTXViewer({ canvas, slideSizeMode: "fit" });
      await viewer.loadFile(bytes.slice().buffer);
      if (cancelled) return;
      viewerRef.current = viewer;
      setCount(viewer.getSlideCount());
      await viewer.goToSlide(0, canvas);
      if (!cancelled) setLoading(false);
    })().catch((e) => {
      if (!cancelled) { setError(e instanceof Error ? e.message : String(e)); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [bytes]);

  const go = useCallback(async (next: number) => {
    const viewer = viewerRef.current;
    if (!viewer || next < 0 || next >= count) return;
    await viewer.goToSlide(next, canvasRef.current);
    setSlide(next);
  }, [count]);

  return (
    <div className="flex h-full flex-col bg-foreground/[0.03]">
      <div className="relative flex flex-1 items-center justify-center overflow-auto p-4">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
          </div>
        )}
        {error && (
          <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted-foreground/70">{error}</p>
        )}
        <canvas ref={canvasRef} className="max-h-full max-w-full rounded-sm bg-white shadow-md ring-1 ring-black/5" />
      </div>
      {count > 1 && !error && (
        <div className="flex shrink-0 items-center justify-center gap-3 border-t border-foreground/[0.08] px-4 py-2">
          <button type="button" onClick={() => go(slide - 1)} disabled={slide === 0}
            className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground/60 hover:bg-foreground/[0.06] hover:text-foreground disabled:opacity-30">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs tabular-nums text-muted-foreground/60">{slide + 1} / {count}</span>
          <button type="button" onClick={() => go(slide + 1)} disabled={slide >= count - 1}
            className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground/60 hover:bg-foreground/[0.06] hover:text-foreground disabled:opacity-30">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
