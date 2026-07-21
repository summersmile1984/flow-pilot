import { lazy, Suspense, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

const PdfRenderer = lazy(() => import("./PdfRenderer"));

type Preview =
  | { kind: "pdf"; bytes: Uint8Array }
  | { kind: "image"; url: string };

/**
 * Apple iWork files (.pages / .numbers / .key) are ZIP bundles that embed a
 * QuickLook preview — a PDF on older files, a JPEG on newer ones. We extract
 * whichever is present and render it, since the document body itself is a
 * proprietary protobuf format with no open renderer.
 */
export default function IworkRenderer({ bytes }: { bytes: Uint8Array }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    (async () => {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(bytes);
      if (cancelled) return;
      const names = Object.keys(zip.files);
      const find = (re: RegExp) => names.find((n) => re.test(n));
      const pdfName = find(/(^|\/)(quicklook\/)?preview\.pdf$/i) ?? find(/\.pdf$/i);
      if (pdfName) {
        const buf = await zip.files[pdfName].async("uint8array");
        if (!cancelled) setPreview({ kind: "pdf", bytes: buf });
        return;
      }
      const imgName = find(/(^|\/)(quicklook\/)?preview[^/]*\.(jpe?g|png)$/i) ?? find(/preview[^/]*\.(jpe?g|png)$/i);
      if (imgName) {
        const blob = await zip.files[imgName].async("blob");
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPreview({ kind: "image", url: objectUrl });
        return;
      }
      if (!cancelled) setError("No preview embedded in this iWork file");
    })().catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [bytes]);

  const spinner = (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
    </div>
  );

  if (error) return <div className="flex h-full items-center justify-center p-6"><p className="text-center text-sm text-muted-foreground/70">{error}</p></div>;
  if (!preview) return spinner;
  if (preview.kind === "pdf") {
    return <Suspense fallback={spinner}><PdfRenderer bytes={preview.bytes} /></Suspense>;
  }
  return (
    <div className="flex h-full items-center justify-center overflow-auto bg-foreground/[0.03] p-4">
      <img src={preview.url} alt="iWork preview" className="max-h-full max-w-full object-contain rounded-sm shadow-md" />
    </div>
  );
}
