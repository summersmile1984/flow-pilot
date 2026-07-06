import { BrowserWindow, ipcMain } from "electron";
import { initMastraService, destroyMastraService } from "../lib/mastra-service";
import { log } from "../lib/logger";
import { safeSend } from "../lib/safe-send";
import type { Session } from "@mastra/core/agent-controller";

let currentSession: Session | null = null;

export function register(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle("mastra:init", async (_event, projectPath: string) => {
    try {
      const ac = await initMastraService(projectPath);
      currentSession = await ac.createSession({
        id: `session-${Date.now()}`,
        ownerId: "local-user",
      });
      log("mastra-ipc", `Session created: ${currentSession.identity.getId()}`);
      return { success: true, sessionId: currentSession.identity.getId() };
    } catch (err) {
      log("mastra-ipc", `Init failed: ${err}`);
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle("mastra:sendMessage", async (_event, content: string) => {
    if (!currentSession) return { success: false, error: "Mastra not initialized" };
    try {
      const unsubscribe = currentSession.subscribe((event) => {
        safeSend(getMainWindow, "mastra:event", event);
      });
      await currentSession.sendMessage({ content });
      unsubscribe();
      return { success: true };
    } catch (err) {
      log("mastra-ipc", `sendMessage failed: ${err}`);
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle("mastra:abort", async () => {
    if (currentSession) currentSession.abort();
    return { success: true };
  });

  ipcMain.handle("mastra:switchMode", async (_event, modeId: string) => {
    if (!currentSession) return { success: false, error: "Mastra not initialized" };
    try {
      await currentSession.mode.switch({ modeId });
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle("mastra:getDisplayState", async () => {
    if (!currentSession) return { success: false, error: "Mastra not initialized" };
    return { success: true, state: currentSession.displayState.get() };
  });

  ipcMain.handle("mastra:destroy", async () => {
    currentSession = null;
    await destroyMastraService();
    return { success: true };
  });
}
