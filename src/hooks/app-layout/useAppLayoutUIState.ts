import { useCallback, useEffect, useState } from "react";
import type { GrabbedElement } from "@/types";
import { WELCOME_COMPLETED_KEY } from "@/components/welcome/shared";

interface UseAppLayoutUIStateInput {
  isNativeGlass: boolean;
  onHideSettings: () => void;
}

export function useAppLayoutUIState(input: UseAppLayoutUIStateInput) {
  const [windowFocused, setWindowFocused] = useState(true);
  const [welcomeCompleted, setWelcomeCompleted] = useState(
    () => localStorage.getItem(WELCOME_COMPLETED_KEY) === "true",
  );
  const [grabbedElements, setGrabbedElements] = useState<GrabbedElement[]>([]);
  // Open preview tabs (file paths) + which one is active, like an editor.
  const [previewTabs, setPreviewTabs] = useState<string[]>([]);
  const [activePreviewPath, setActivePreviewPath] = useState<string | null>(null);

  useEffect(() => {
    if (!input.isNativeGlass) return;
    const onFocus = () => setWindowFocused(true);
    const onBlur = () => setWindowFocused(false);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
    };
  }, [input.isNativeGlass]);

  const handleWelcomeComplete = useCallback(() => {
    localStorage.setItem(WELCOME_COMPLETED_KEY, "true");
    setWelcomeCompleted(true);
  }, []);

  const handleReplayWelcome = useCallback(() => {
    localStorage.removeItem(WELCOME_COMPLETED_KEY);
    setWelcomeCompleted(false);
    input.onHideSettings();
  }, [input]);

  const handleElementGrab = useCallback((element: GrabbedElement) => {
    setGrabbedElements((prev) => [...prev, element]);
  }, []);

  const handleRemoveGrabbedElement = useCallback((id: string) => {
    setGrabbedElements((prev) => prev.filter((element) => element.id !== id));
  }, []);

  const clearGrabbedElements = useCallback(() => {
    setGrabbedElements([]);
  }, []);

  const handlePreviewFile = useCallback((filePath: string) => {
    setPreviewTabs((prev) => (prev.includes(filePath) ? prev : [...prev, filePath]));
    setActivePreviewPath(filePath);
  }, []);

  const selectPreviewTab = useCallback((filePath: string) => {
    setActivePreviewPath(filePath);
  }, []);

  const closePreviewTab = useCallback((filePath: string) => {
    setPreviewTabs((prev) => {
      const idx = prev.indexOf(filePath);
      const next = prev.filter((p) => p !== filePath);
      setActivePreviewPath((active) => {
        if (active !== filePath) return active;
        if (next.length === 0) return null;
        // Activate the neighbor (prefer the one that shifted into this slot).
        return next[Math.min(idx, next.length - 1)];
      });
      return next;
    });
  }, []);

  const handleClosePreview = useCallback(() => {
    setPreviewTabs([]);
    setActivePreviewPath(null);
  }, []);

  return {
    windowFocused,
    welcomeCompleted,
    handleWelcomeComplete,
    handleReplayWelcome,
    grabbedElements,
    clearGrabbedElements,
    handleElementGrab,
    handleRemoveGrabbedElement,
    previewTabs,
    activePreviewPath,
    handlePreviewFile,
    selectPreviewTab,
    closePreviewTab,
    handleClosePreview,
  };
}
