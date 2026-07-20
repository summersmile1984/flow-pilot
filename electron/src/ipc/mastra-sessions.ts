import { BrowserWindow, ipcMain } from "electron";
import { initMastraService, destroyMastraService, getPilotConfig, type AgentMode } from "../lib/mastra-service";
import { log } from "../lib/logger";
import { safeSend } from "../lib/safe-send";
import type { Session } from "@mastra/core/agent-controller";

// One Mastra session per Pilot chat. `createSession` resumes persisted
// sessions matching the same owner/resource, so each chat passes a unique
// resourceId to force a fresh session (and thread) per conversation.
const sessions = new Map<string, Session>();
let currentSession: Session | null = null;
let currentMode: AgentMode = 'supervisor';
let currentDirectAgentId: string | undefined;
let currentSupervisorAgentId: string | undefined;

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
  async function ensureSession(
    sessionId: string,
    cwd: string,
    mode?: AgentMode,
    directAgentId?: string,
    supervisorAgentId?: string,
  ): Promise<Session> {
    const existing = sessions.get(sessionId);
    if (existing) return existing;

    // Use provided mode or fall back to current mode
    const effectiveMode = mode || currentMode;
    const effectiveDirectAgentId = directAgentId || currentDirectAgentId;
    const effectiveSupervisorAgentId = supervisorAgentId || currentSupervisorAgentId;

    const ac = await initMastraService({
      projectPath: cwd,
      mode: effectiveMode,
      directAgentId: effectiveDirectAgentId,
      supervisorAgentId: effectiveSupervisorAgentId,
    });
    const session = await ac.createSession({
      id: sessionId,
      resourceId: sessionId,
      ownerId: "local-user",
    });
    sessions.set(session.identity.getId(), session);
    currentSession = session;

    // Store mode for future sessions
    if (mode) {
      currentMode = mode;
      currentDirectAgentId = directAgentId;
      currentSupervisorAgentId = supervisorAgentId;
    }

    return session;
  }

  /** Enable yolo mode on an existing session (auto-approve all tool calls). */
  async function enableYoloMode(session: Session): Promise<void> {
    try {
      await (session.state as { set: (u: Record<string, unknown>) => Promise<void> }).set({ yolo: true });
      log("mastra-ipc", "Yolo mode enabled");
    } catch (err) {
      log("mastra-ipc", `Failed to enable yolo mode: ${err}`);
    }
  }

  ipcMain.handle("mastra:start", async (_event, options: {
    cwd: string;
    mode?: AgentMode;
    directAgentId?: string;
    supervisorAgentId?: string;
  }) => {
    log("mastra-ipc", `mastra:start called with cwd=${options.cwd}, mode=${options.mode || 'supervisor'}`);
    try {
      const requestedId = `mastra-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const session = await ensureSession(
        requestedId,
        options.cwd,
        options.mode,
        options.directAgentId,
        options.supervisorAgentId,
      );
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

  /**
   * Set the permission mode for a Mastra session.
   * - "default": ask for approval on each tool call
   * - "bypassPermissions": auto-approve all tool calls (yolo mode)
   */
  ipcMain.handle(
    "mastra:setPermissionMode",
    async (_event, { mode, sessionId }: { mode: "default" | "bypassPermissions"; sessionId?: string }) => {
      const session = getSession(sessionId);
      if (!session) return { success: false, error: "Mastra not initialized" };
      try {
        if (mode === "bypassPermissions") {
          await enableYoloMode(session);
        } else {
          // Disable yolo mode
          try {
            await (session.state as { set: (u: Record<string, unknown>) => Promise<void> }).set({ yolo: false });
            log("mastra-ipc", "Yolo mode disabled");
          } catch {
            // Ignore if state doesn't support yolo toggle
          }
        }
        return { success: true };
      } catch (err) {
        log("mastra-ipc", `setPermissionMode failed: ${err}`);
        return { success: false, error: String(err) };
      }
    },
  );

  ipcMain.handle("mastra:destroy", async () => {
    currentSession = null;
    sessions.clear();
    currentMode = 'supervisor';
    currentDirectAgentId = undefined;
    currentSupervisorAgentId = undefined;
    await destroyMastraService();
    return { success: true };
  });

  ipcMain.handle("mastra:setModel", async (_event, { model, cwd }: { model: string; cwd: string }) => {
    log("mastra-ipc", `mastra:setModel called with model=${model}, cwd=${cwd}`);
    try {
      // Destroy current service and reinitialize with new model, preserving current mode
      currentSession = null;
      sessions.clear();
      await destroyMastraService();
      // Reinitialize with model override, keeping the current mode
      await initMastraService({
        projectPath: cwd,
        mode: currentMode,
        modelOverride: model,
        directAgentId: currentDirectAgentId,
        supervisorAgentId: currentSupervisorAgentId,
      });
      log("mastra-ipc", `Model changed to: ${model} (mode: ${currentMode})`);
      return { success: true };
    } catch (err) {
      log("mastra-ipc", `setModel failed: ${err}`);
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle("mastra:getConfig", async (_event, cwd: string) => {
    try {
      const config = getPilotConfig(cwd);
      return { success: true, config };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle("mastra:getCurrentMode", async () => {
    return {
      mode: currentMode,
      directAgentId: currentDirectAgentId,
      supervisorAgentId: currentSupervisorAgentId,
    };
  });
}
