import { useState, useEffect, useCallback, useRef } from 'react';

export function useMastra() {
  const [mode, setMode] = useState<string>('plan');
  const [isInitialized, setIsInitialized] = useState(false);
  const [events, setEvents] = useState<unknown[]>([]);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      unsubscribeRef.current?.();
    };
  }, []);

  const init = useCallback(async (projectPath: string) => {
    const result = await (window as any).pilot.mastra.init(projectPath);
    if (result.success) {
      setIsInitialized(true);
      unsubscribeRef.current = (window as any).pilot.mastra.onEvent((event: unknown) => {
        setEvents((prev) => [...prev, event]);
      });
    }
    return result;
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    setEvents([]);
    return (window as any).pilot.mastra.sendMessage(content);
  }, []);

  const abort = useCallback(async () => {
    return (window as any).pilot.mastra.abort();
  }, []);

  const switchMode = useCallback(async (modeId: string) => {
    const result = await (window as any).pilot.mastra.switchMode(modeId);
    if (result.success) setMode(modeId);
    return result;
  }, []);

  const getDisplayState = useCallback(async () => {
    return (window as any).pilot.mastra.getDisplayState();
  }, []);

  const destroy = useCallback(async () => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    setIsInitialized(false);
    setEvents([]);
    return (window as any).pilot.mastra.destroy();
  }, []);

  return { init, sendMessage, abort, switchMode, getDisplayState, destroy, isInitialized, events, mode };
}
