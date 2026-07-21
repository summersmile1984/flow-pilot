import { useCallback, useEffect, useRef } from "react";
import { X, FileText } from "lucide-react";
import { OpenInEditorButton } from "./OpenInEditorButton";
import { FilePreviewContent } from "./preview/FilePreviewContent";

interface PreviewPaneProps {
  filePath: string;
  /** Current pane width in px. */
  width: number;
  /** Called with a new width during a left-edge drag. */
  onWidthChange: (width: number) => void;
  onClose: () => void;
  /** Left/right bounds (px) the pane width is clamped to while dragging. */
  minWidth: number;
  maxWidth: number;
}

/**
 * A large, resizable file preview pane anchored to the right of the main
 * content area. Unlike a modal it never covers the chat — you keep chatting on
 * the left and drag its left edge to make the preview as wide as you like.
 */
export function PreviewPane({ filePath, width, onWidthChange, onClose, minWidth, maxWidth }: PreviewPaneProps) {
  const fileName = filePath.split("/").pop() ?? filePath;
  const dragging = useRef(false);

  const onHandleDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      // Pane is right-anchored: width grows as the pointer moves left.
      const next = Math.min(maxWidth, Math.max(minWidth, window.innerWidth - e.clientX));
      onWidthChange(next);
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [minWidth, maxWidth, onWidthChange]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="absolute inset-y-0 end-0 z-20 flex"
      style={{ width }}
    >
      {/* Left-edge resize handle */}
      <div
        onMouseDown={onHandleDown}
        className="group relative w-1 shrink-0 cursor-col-resize"
        title="Drag to resize"
      >
        <div className="absolute inset-y-0 -inset-x-1" />
        <div className="absolute inset-y-0 start-0 w-px bg-foreground/10 transition-colors group-hover:bg-foreground/30" />
      </div>

      <div className="island relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-[var(--island-radius)] border border-foreground/10 bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-foreground/[0.08] px-3 py-2">
          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{fileName}</span>
          <OpenInEditorButton
            filePath={filePath}
            className="!text-muted-foreground/40 hover:!text-muted-foreground"
          />
          <button
            type="button"
            onClick={onClose}
            title="Close preview"
            className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md
              text-muted-foreground/40 transition-colors hover:text-foreground hover:bg-foreground/[0.06] active:scale-90"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="min-h-0 flex-1">
          <FilePreviewContent key={filePath} filePath={filePath} />
        </div>
      </div>
    </div>
  );
}
