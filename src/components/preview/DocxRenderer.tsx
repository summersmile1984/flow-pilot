import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

/** Render a .docx to formatted HTML via docx-preview (keeps styles, tables, images). */
export default function DocxRenderer({ bytes }: { bytes: Uint8Array }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { renderAsync } = await import("docx-preview");
      const container = containerRef.current;
      if (!container || cancelled) return;
      container.innerHTML = "";
      await renderAsync(bytes.slice(), container, undefined, {
        className: "docx",
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: false,
        breakPages: true,
        useBase64URL: true,
      });
      if (!cancelled) setLoading(false);
    })().catch((e) => {
      if (!cancelled) { setError(e instanceof Error ? e.message : String(e)); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [bytes]);

  return (
    <div className="relative h-full overflow-auto bg-foreground/[0.03] py-4">
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
      {/* docx-preview injects its own page styling (white A4-like pages) */}
      <div ref={containerRef} className="docx-preview-host" />
    </div>
  );
}
