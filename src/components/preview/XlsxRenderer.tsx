import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface Sheet {
  name: string;
  html: string;
}

/** Render a spreadsheet (xlsx/xls/ods) to HTML tables via SheetJS, with sheet tabs. */
export default function XlsxRenderer({ bytes }: { bytes: Uint8Array }) {
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(bytes, { type: "array" });
      if (cancelled) return;
      const parsed = wb.SheetNames.map((name) => ({
        name,
        html: XLSX.utils.sheet_to_html(wb.Sheets[name], { editable: false }),
      }));
      setSheets(parsed);
      setLoading(false);
    })().catch((e) => {
      if (!cancelled) { setError(e instanceof Error ? e.message : String(e)); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [bytes]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-center text-sm text-muted-foreground/70">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div
        className="xlsx-preview flex-1 overflow-auto bg-background p-2"
        dangerouslySetInnerHTML={{ __html: sheets[active]?.html ?? "" }}
      />
      {sheets.length > 1 && (
        <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-t border-foreground/[0.08] px-2 py-1.5">
          {sheets.map((s, i) => (
            <button
              key={s.name}
              type="button"
              onClick={() => setActive(i)}
              className={`shrink-0 rounded px-2.5 py-1 text-xs transition-colors ${
                i === active
                  ? "bg-foreground/10 text-foreground"
                  : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
