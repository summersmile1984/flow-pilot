import { useCallback, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { OpenInEditorButton } from "./OpenInEditorButton";
import { FilePreviewContent } from "./preview/FilePreviewContent";

interface PreviewPaneProps {
  /** Open file paths, in tab order. */
  tabs: string[];
  /** Currently shown file path. */
  activePath: string;
  onSelectTab: (path: string) => void;
  onCloseTab: (path: string) => void;
  /** Close the whole pane. */
  onClose: () => void;
  /** Current pane width in px. */
  width: number;
  onWidthChange: (width: number) => void;
  minWidth: number;
  maxWidth: number;
}

/**
 * A large, resizable file preview pane anchored to the right of the main
 * content area — an editor-like surface with tabs for multiple open files.
 * Unlike a modal it never covers the chat; drag its left edge to resize.
 */
export function PreviewPane({ tabs, activePath, onSelectTab, onCloseTab, onClose, width, onWidthChange, minWidth, maxWidth }: PreviewPaneProps) {
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
      onWidthChange(Math.min(maxWidth, Math.max(minWidth, window.innerWidth - e.clientX)));
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="absolute inset-y-0 end-0 z-20 flex" style={{ width }}>
      {/* Left-edge resize handle */}
      <div onMouseDown={onHandleDown} className="group relative w-1 shrink-0 cursor-col-resize" title="Drag to resize">
        <div className="absolute inset-y-0 -inset-x-1" />
        <div className="absolute inset-y-0 start-0 w-px bg-foreground/10 transition-colors group-hover:bg-foreground/30" />
      </div>

      <div className="island relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-[var(--island-radius)] border border-foreground/10 bg-background shadow-2xl">
        {/* Tab strip */}
        <div className="flex items-stretch border-b border-foreground/[0.08]">
          <div className="flex min-w-0 flex-1 items-stretch overflow-x-auto">
            {tabs.map((path) => {
              const name = path.split("/").pop() ?? path;
              const isActive = path === activePath;
              return (
                <div
                  key={path}
                  onClick={() => onSelectTab(path)}
                  className={`group flex max-w-[200px] shrink-0 cursor-pointer items-center gap-1.5 border-e border-foreground/[0.06] px-3 py-1.5 text-xs transition-colors ${
                    isActive ? "bg-foreground/[0.06] text-foreground" : "text-muted-foreground hover:bg-foreground/[0.03] hover:text-foreground/80"
                  }`}
                  title={path}
                >
                  <span className="truncate">{name}</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onCloseTab(path); }}
                    className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded transition-opacity hover:bg-foreground/10 ${
                      isActive ? "opacity-60 hover:opacity-100" : "opacity-0 group-hover:opacity-60"
                    }`}
                    title="Close tab"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="flex shrink-0 items-center gap-0.5 px-2">
            <OpenInEditorButton filePath={activePath} className="!text-muted-foreground/40 hover:!text-muted-foreground" />
            <button
              type="button"
              onClick={onClose}
              title="Close preview"
              className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground/40 transition-colors hover:text-foreground hover:bg-foreground/[0.06] active:scale-90"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1">
          <FilePreviewContent key={activePath} filePath={activePath} />
        </div>
      </div>
    </div>
  );
}
