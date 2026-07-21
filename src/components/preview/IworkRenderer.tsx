import { lazy, Suspense, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

const PdfRenderer = lazy(() => import("./PdfRenderer"));

type Preview =
  | { kind: "pdf"; bytes: Uint8Array }
  | { kind: "image"; url: string };

function base64ToBytes(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

/**
 * Apple iWork files (.pages / .numbers / .key) have a proprietary protobuf body
 * with no open renderer. LibreOffice imports the real document and exports every
 * page/slide to a PDF, which we render in full — so multi-slide Keynotes show
 * all slides. If LibreOffice is unavailable we fall back to the single-page
 * QuickLook preview embedded in the file's ZIP.
 */
export default function IworkRenderer({ filePath }: { filePath: string }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    const extractEmbedded = async () => {
      const res = await window.claude.readFileBinary(filePath);
      if (cancelled) return;
      if (res.error || !res.base64) throw new Error(res.error ?? "Failed to read file");
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(base64ToBytes(res.base64));
      if (cancelled) return;
      const names = Object.keys(zip.files);
      const find = (re: RegExp) => names.find((n) => re.test(n));
      const pdfName = find(/(^|\/)(quicklook\/)?preview\.pdf$/i) ?? find(/\.pdf$/i);
      if (pdfName) { setPreview({ kind: "pdf", bytes: await zip.files[pdfName].async("uint8array") }); return; }
      const imgName = find(/(^|\/)(quicklook\/)?preview[^/]*\.(jpe?g|png)$/i) ?? find(/preview[^/]*\.(jpe?g|png)$/i);
      if (imgName) {
        objectUrl = URL.createObjectURL(await zip.files[imgName].async("blob"));
        if (!cancelled) setPreview({ kind: "image", url: objectUrl });
        return;
      }
      throw new Error("No preview available for this iWork file");
    };

    (async () => {
      // Prefer LibreOffice — it renders every page/slide, not just the cover.
      const converted = await window.claude.convertToPdf(filePath).catch(() => ({ error: "convert unavailable" }));
      if (cancelled) return;
      if (converted && "base64" in converted && converted.base64) {
        setPreview({ kind: "pdf", bytes: base64ToBytes(converted.base64) });
        return;
      }
      await extractEmbedded();
    })().catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });

    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [filePath]);

  const spinner = (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
    </div>
  );

  if (error) return <div className="flex h-full items-center justify-center p-6"><p className="max-w-md text-center text-sm text-muted-foreground/70">{error}</p></div>;
  if (!preview) return spinner;
  if (preview.kind === "pdf") return <Suspense fallback={spinner}><PdfRenderer bytes={preview.bytes} /></Suspense>;
  return (
    <div className="flex h-full items-center justify-center overflow-auto bg-foreground/[0.03] p-4">
      <img src={preview.url} alt="iWork preview" className="max-h-full max-w-full object-contain rounded-sm shadow-md" />
    </div>
  );
}
