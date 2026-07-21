import { BrowserWindow, ipcMain } from "electron";
import { initMastraService, destroyMastraService, getPilotConfig, DEFAULT_SUPERVISOR_MODELS, type AgentMode } from "../lib/mastra-service";
import { getAppSettings } from "../lib/app-settings";
import { onSettingsChanged } from "./settings";
import type { McpServerInput } from "@shared/lib/mcp-config";
import { log } from "../lib/logger";
import { safeSend } from "../lib/safe-send";
import type { Session } from "@mastra/core/agent-controller";

// One Mastra session per Pilot chat. `createSession` resumes persisted
// sessions matching the same owner/resource, so each chat passes a unique
// resourceId to force a fresh session (and thread) per conversation.
const sessions = new Map<string, Session>();
// Session-level event forwarding lives for the whole session (not per send):
// suspended runs (ask_user) resume outside any sendMessage call, and their
// follow-up stream events must still reach the renderer.
const subscriptions = new Map<string, () => void>();
let currentSession: Session | null = null;
let currentMode: AgentMode = 'supervisor';
let currentDirectAgentId: string | undefined;
let currentSupervisorAgentId: string | undefined;

/** Tear down all cached sessions/subscriptions and controllers. */
async function resetMastraState(): Promise<void> {
  currentSession = null;
  for (const unsubscribe of subscriptions.values()) unsubscribe();
  subscriptions.clear();
  sessions.clear();
  await destroyMastraService();
}

function getSession(sessionId?: string): Session | null {
  if (sessionId) return sessions.get(sessionId) ?? null;
  return currentSession;
}

export function register(getMainWindow: () => BrowserWindow | null): void {
  // Rebuild controllers when the supervisor LLM provider changes — the API key
  // and base URL are baked into each controller's agent, so a cached one would
  // keep using the old credentials otherwise.
  let lastProvider = `${getAppSettings().pilotSupervisorApiKey}::${getAppSettings().pilotSupervisorBaseUrl}`;
  onSettingsChanged((next) => {
    const provider = `${next.pilotSupervisorApiKey}::${next.pilotSupervisorBaseUrl}`;
    if (provider !== lastProvider) {
      lastProvider = provider;
      log("mastra-ipc", "Supervisor LLM provider changed — resetting controllers");
      void resetMastraState();
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
    permissionMode?: string,
    mcpServers?: McpServerInput[],
    model?: string,
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
      mcpServers,
      modelOverride: model,
    });
    const session = await ac.createSession({
      id: sessionId,
      resourceId: sessionId,
      ownerId: "local-user",
    });
    const realId = session.identity.getId();
    sessions.set(realId, session);
    const unsubscribe = session.subscribe((event) => {
      if (event.type === "error") log("mastra-ipc", event);
      safeSend(getMainWindow, "mastra:event", { sessionId: realId, ...event });
    });
    subscriptions.set(realId, unsubscribe);
    // Asking the user a question needs no permission gate — the question panel
    // IS the user interaction. Without this the approval prompt fires first.
    try {
      await session.permissions.setForTool({ toolName: "ask_user", policy: "allow" });
    } catch (err) {
      log("mastra-ipc", `ask_user allow policy failed: ${err}`);
    }
    // The chat's recorded permission mode: "Allow All" (bypassPermissions)
    // maps to yolo — auto-approve every tool call in this session.
    if (permissionMode === "bypassPermissions") {
      await enableYoloMode(session);
    }
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
    permissionMode?: string;
    mcpServers?: McpServerInput[];
    model?: string;
  }) => {
    log("mastra-ipc", `mastra:start called with cwd=${options.cwd}, mode=${options.mode || 'supervisor'}${options.model ? `, model=${options.model}` : ''}`);
    try {
      const requestedId = `mastra-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const session = await ensureSession(
        requestedId,
        options.cwd,
        options.mode,
        options.directAgentId,
        options.supervisorAgentId,
        options.permissionMode,
        options.mcpServers,
        options.model,
      );
      const sessionId = session.identity.getId();
      log("mastra-ipc", `Session created: ${sessionId} (requested ${requestedId})`);
      return { sessionId };
    } catch (err) {
      log("mastra-ipc", `Start failed: ${err}`);
      return { error: String(err) };
    }
  });

  ipcMain.handle("mastra:send", async (_event, { sessionId, content, cwd, resume }: {
    sessionId: string;
    content: string;
    cwd?: string;
    resume?: { mode?: AgentMode; agentId?: string; permissionMode?: string; mcpServers?: McpServerInput[]; model?: string };
  }) => {
    log("mastra-ipc", `mastra:send called with sessionId=${sessionId}, content=${content.substring(0, 50)}...`);
    let session = getSession(sessionId);
    if (!session && cwd) {
      // App restarted since this chat was created — resume it with the mode
      // the chat was originally created in (recorded on the session entry)
      try {
        session = await ensureSession(
          sessionId,
          cwd,
          resume?.mode,
          resume?.mode === "direct" ? resume?.agentId : undefined,
          resume?.mode === "acp-supervisor" ? resume?.agentId : undefined,
          resume?.permissionMode,
          resume?.mcpServers,
          resume?.model,
        );
        log("mastra-ipc", `Session resumed: ${sessionId} (mode=${resume?.mode ?? currentMode})`);
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
      await session.sendMessage({ content });
      log("mastra-ipc", "sendMessage done");
      return { ok: true };
    } catch (err) {
      log("mastra-ipc", `Send failed: ${err}`);
      return { error: String(err) };
    }
  });

  /**
   * Resume a tool parked via the native suspension primitive (ask_user, …).
   * `resumeData` is the user's answer: a string for free-text/single-select,
   * a string[] for multi-select.
   */
  ipcMain.handle(
    "mastra:respondToSuspension",
    async (_event, { resumeData, toolCallId, sessionId }: { resumeData: unknown; toolCallId?: string; sessionId?: string }) => {
      const session = getSession(sessionId);
      if (!session) return { success: false, error: "Mastra not initialized" };
      try {
        log("mastra-ipc", `Suspension response for ${toolCallId ?? "sole pending"}: ${JSON.stringify(resumeData).slice(0, 120)}`);
        await session.respondToToolSuspension({ resumeData, toolCallId });
        return { success: true };
      } catch (err) {
        log("mastra-ipc", `respondToSuspension failed: ${err}`);
        return { success: false, error: String(err) };
      }
    },
  );

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
    await resetMastraState();
    currentMode = 'supervisor';
    currentDirectAgentId = undefined;
    currentSupervisorAgentId = undefined;
    return { success: true };
  });

  ipcMain.handle("mastra:setModel", async (_event, { model, cwd }: { model: string; cwd: string }) => {
    log("mastra-ipc", `mastra:setModel called with model=${model}, cwd=${cwd}`);
    try {
      // Destroy current service and reinitialize with new model, preserving current mode
      currentSession = null;
      for (const unsubscribe of subscriptions.values()) unsubscribe();
      subscriptions.clear();
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
      // Resolve the selectable supervisor model list so the picker always has
      // options even when config.yaml doesn't define supervisor.models.
      const models = config.supervisor?.models?.length
        ? config.supervisor.models
        : DEFAULT_SUPERVISOR_MODELS;
      const defaultModel = config.supervisor?.model || models[0];
      return {
        success: true,
        config: {
          ...config,
          supervisor: { ...config.supervisor, model: defaultModel, models },
        },
      };
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
