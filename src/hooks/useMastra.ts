import { useState, useEffect, useCallback, useRef } from 'react';

export interface PilotConfig {
  supervisor?: { model?: string };
  agents?: Record<string, { command: string; args: string[]; capabilities?: string[]; strengths?: string[] }>;
}

export type MastraPermissionMode = 'default' | 'bypassPermissions';

export interface MastraError {
  message: string;
  code?: string;
}

export function useMastra() {
  const [mode, setMode] = useState<string>('plan');
  const [permissionMode, setPermissionModeState] = useState<MastraPermissionMode>('default');
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<MastraError | null>(null);
  const [events, setEvents] = useState<unknown[]>([]);
  const [config, setConfig] = useState<PilotConfig | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      unsubscribeRef.current?.();
    };
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const init = useCallback(async (projectPath: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await window.pilot.mastra.init(projectPath);
      if (result.success) {
        setIsInitialized(true);
        // Re-init must not stack subscriptions — drop the previous one first
        unsubscribeRef.current?.();
        unsubscribeRef.current = window.pilot.mastra.onEvent((event: unknown) => {
          setEvents((prev) => [...prev, event]);
        });
        // Load config after init
        const configResult = await window.pilot.mastra.getConfig(projectPath);
        if (configResult.success) setConfig((configResult.config as PilotConfig | undefined) ?? null);
      } else {
        setError({ message: result.error || 'Failed to initialize Mastra' });
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError({ message });
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    setEvents([]);
    setError(null);
    try {
      return await window.pilot.mastra.sendMessage(content);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send message';
      setError({ message });
      return { success: false, error: message };
    }
  }, []);

  const abort = useCallback(async () => {
    try {
      return await window.pilot.mastra.abort();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to abort';
      setError({ message });
      return { success: false, error: message };
    }
  }, []);

  const switchMode = useCallback(async (modeId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await window.pilot.mastra.switchMode(modeId);
      if (result.success) setMode(modeId);
      else setError({ message: result.error || 'Failed to switch mode' });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to switch mode';
      setError({ message });
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getDisplayState = useCallback(async () => {
    try {
      return await window.pilot.mastra.getDisplayState();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get display state';
      setError({ message });
      return { success: false, error: message };
    }
  }, []);

  const setModel = useCallback(async (model: string, cwd: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await window.pilot.mastra.setModel({ model, cwd });
      if (result.success) {
        setConfig((prev) => prev ? { ...prev, supervisor: { ...prev.supervisor, model } } : null);
      } else {
        setError({ message: result.error || 'Failed to set model' });
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to set model';
      setError({ message });
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setPermissionMode = useCallback(async (permMode: MastraPermissionMode) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await window.pilot.mastra.setPermissionMode({ mode: permMode });
      if (result.success) setPermissionModeState(permMode);
      else setError({ message: result.error || 'Failed to set permission mode' });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to set permission mode';
      setError({ message });
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getConfig = useCallback(async (cwd: string) => {
    try {
      const result = await window.pilot.mastra.getConfig(cwd);
      if (result.success) setConfig((result.config as PilotConfig | undefined) ?? null);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get config';
      setError({ message });
      return { success: false, error: message };
    }
  }, []);

  const destroy = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
      setIsInitialized(false);
      setEvents([]);
      setConfig(null);
      setPermissionModeState('default');
      return await window.pilot.mastra.destroy();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to destroy';
      setError({ message });
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    init, sendMessage, abort, switchMode, getDisplayState,
    setModel, setPermissionMode, getConfig, destroy, clearError,
    isInitialized, isLoading, error, events, mode, permissionMode, config,
  };
}
