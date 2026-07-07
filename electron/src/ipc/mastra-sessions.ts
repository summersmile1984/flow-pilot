import { BrowserWindow, ipcMain } from "electron";
import { initMastraService, destroyMastraService } from "../lib/mastra-service";
import { log } from "../lib/logger";
import { safeSend } from "../lib/safe-send";
import type { Session } from "@mastra/core/agent-controller";

// One Mastra session per Pilot chat. `createSession` resumes persisted
// sessions matching the same owner/resource, so each chat passes a unique
// resourceId to force a fresh session (and thread) per conversation.
const sessions = new Map<string, Session>();
let currentSession: Session | null = null;

function getSession(sessionId?: string): Session | null {
  if (sessionId) return sessions.get(sessionId) ?? null;
  return currentSession;
}

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

  /**
   * Create (or resume) a session with `id` as both session id and resourceId —
   * LibSQL resumes the persisted thread for a known resourceId, so reopened
   * chats keep their history across app restarts.
   */
  async function ensureSession(sessionId: string, cwd: string): Promise<Session> {
    const existing = sessions.get(sessionId);
    if (existing) return existing;
    const ac = await initMastraService(cwd);
    const session = await ac.createSession({
      id: sessionId,
      resourceId: sessionId,
      ownerId: "local-user",
    });
    sessions.set(session.identity.getId(), session);
    currentSession = session;
    // Run sessions in yolo mode (no tool-approval gates) until the UI grows
    // a real approval panel. The approve-resume path is also unusable for
    // ACP subagent delegations: resume hands resumeData to the delegation
    // tool, which calls AcpAgent.resumeStream() — unsupported, instant fail.
    // The ACP subagents still enforce their own internal permissions.
    try {
      await (session.state as { set: (u: Record<string, unknown>) => Promise<void> }).set({ yolo: true });
    } catch (err) {
      log("mastra-ipc", `Failed to enable yolo mode: ${err}`);
    }
    return session;
  }

  ipcMain.handle("mastra:start", async (_event, options: { cwd: string }) => {
    log("mastra-ipc", `mastra:start called with cwd=${options.cwd}`);
    try {
      const requestedId = `mastra-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const session = await ensureSession(requestedId, options.cwd);
      const sessionId = session.identity.getId();
      log("mastra-ipc", `Session created: ${sessionId} (requested ${requestedId})`);
      return { sessionId };
    } catch (err) {
      log("mastra-ipc", `Start failed: ${err}`);
      return { error: String(err) };
    }
  });

  ipcMain.handle("mastra:send", async (_event, { sessionId, content, cwd }: { sessionId: string; content: string; cwd?: string }) => {
    log("mastra-ipc", `mastra:send called with sessionId=${sessionId}, content=${content.substring(0, 50)}...`);
    let session = getSession(sessionId);
    if (!session && cwd) {
      // App restarted since this chat was created — resume the session
      try {
        session = await ensureSession(sessionId, cwd);
        log("mastra-ipc", `Session resumed: ${sessionId}`);
      } catch (err) {
        log("mastra-ipc", `Session resume failed: ${err}`);
        return { error: `Failed to resume session: ${err}` };
      }
    }
    if (!session) {
      log("mastra-ipc", `Send failed: no session for ${sessionId}`);
      return { error: "Mastra not initialized" };
    }
    try {
      let eventCount = 0;
      const unsubscribe = session.subscribe((event) => {
        eventCount++;
        if (event.type === "error") log("mastra-ipc", event);
        safeSend(getMainWindow, "mastra:event", { sessionId, ...event });
      });
      await session.sendMessage({ content });
      log("mastra-ipc", `sendMessage done. Events received: ${eventCount}`);
      unsubscribe();
      return { ok: true };
    } catch (err) {
      log("mastra-ipc", `Send failed: ${err}`);
      return { error: String(err) };
    }
  });

  ipcMain.handle(
    "mastra:respondToApproval",
    async (_event, { decision, toolCallId, sessionId }: { decision: "approve" | "decline"; toolCallId?: string; sessionId?: string }) => {
      const session = getSession(sessionId);
      if (!session) return { success: false, error: "Mastra not initialized" };
      try {
        log("mastra-ipc", `Approval response: ${decision} (toolCallId=${toolCallId ?? "current"})`);
        session.approval.respond({ decision, toolCallId });
        return { success: true };
      } catch (err) {
        log("mastra-ipc", `respondToApproval failed: ${err}`);
        return { success: false, error: String(err) };
      }
    },
  );

  ipcMain.handle(
    "mastra:setToolPolicy",
    async (_event, { toolName, policy, sessionId }: { toolName: string; policy: "allow" | "ask" | "deny"; sessionId?: string }) => {
      const session = getSession(sessionId);
      if (!session) return { success: false, error: "Mastra not initialized" };
      try {
        await session.permissions.setForTool({ toolName, policy });
        log("mastra-ipc", `Tool policy set: ${toolName}=${policy}`);
        return { success: true };
      } catch (err) {
        log("mastra-ipc", `setToolPolicy failed: ${err}`);
        return { success: false, error: String(err) };
      }
    },
  );

  ipcMain.handle("mastra:destroy", async () => {
    currentSession = null;
    sessions.clear();
    await destroyMastraService();
    return { success: true };
  });
}
