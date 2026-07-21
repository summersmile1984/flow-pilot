import type { ReactNode } from "react";
import { Eye } from "lucide-react";
import { PanelHeader } from "./PanelHeader";
import { OpenInEditorButton } from "./OpenInEditorButton";
import { FilePreviewContent } from "./preview/FilePreviewContent";

interface PreviewPanelProps {
  /** Absolute path of the file to preview, or null for the empty state. */
  filePath: string | null;
  headerControls?: ReactNode;
}

/**
 * A docked tool island that previews the file most recently opened from the
 * project files tree — images, PDFs, Office documents, or text — rendered
 * natively in-app. Mirrors the other tool panels' header/layout.
 */
export function PreviewPanel({ filePath, headerControls }: PreviewPanelProps) {
  const fileName = filePath ? filePath.split("/").pop() ?? filePath : null;

  return (
    <div className="flex h-full flex-col">
      <PanelHeader icon={Eye} label={fileName ?? "Preview"} iconClass="text-rose-600/70 dark:text-rose-200/50">
        {filePath && (
          <OpenInEditorButton
            filePath={filePath}
            className="!text-muted-foreground/40 hover:!text-muted-foreground"
          />
        )}
        {headerControls}
      </PanelHeader>

      <div className="min-h-0 flex-1">
        {filePath ? (
          <FilePreviewContent key={filePath} filePath={filePath} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 p-6">
            <Eye className="h-4 w-4 text-foreground/15" />
            <p className="text-center text-[10px] leading-relaxed text-muted-foreground/40">
              Click a file in Project Files to preview it here
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
