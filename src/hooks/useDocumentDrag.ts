import { useCallback, useEffect, useRef } from "react";

/**
 * Document-level drag helper for resize handles.
 *
 * Registers mousemove/mouseup listeners on demand and guarantees teardown on
 * every exit path — mouseup, window blur (mouseup outside the window never
 * fires), starting a new drag, or component unmount. The bare
 * addEventListener-in-callback pattern this replaces leaked listeners (and
 * fired setState on unmounted components) whenever a drag outlived the
 * component or the window lost focus mid-drag.
 */
export function useDocumentDrag(): (
  onMove: (e: MouseEvent) => void,
  onEnd: () => void,
) => void {
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  return useCallback((onMove: (e: MouseEvent) => void, onEnd: () => void) => {
    cleanupRef.current?.();
    const end = () => {
      cleanupRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", end);
      window.removeEventListener("blur", end);
      onEnd();
    };
    cleanupRef.current = end;
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", end);
    window.addEventListener("blur", end);
  }, []);
}
