import type { UIMessage, SubagentToolStep } from "@/types";
import type { InternalState } from "./session-store";
import { nextId } from "@/lib/message-factory";

/** Structured progress payloads emitted by the ACP subagents (see
 *  electron/src/lib/mastra-service.ts StreamingAcpAgent). */
interface MastraToolProgress {
  kind?: "text" | "tool_start" | "tool_end";
  agentId?: string;
  text?: string;
  id?: string;
  title?: string;
  toolKind?: string;
  input?: unknown;
  status?: string;
}

/** Delegation tool calls (`agent-<subagent id>`) render as task cards. */
function isDelegationTool(toolName: string | undefined): boolean {
  return !!toolName && toolName.startsWith("agent-");
}

/** Map ACP tool kinds to Harnss tool names so step rows get familiar icons. */
const ACP_KIND_TO_TOOL: Record<string, string> = {
  read: "Read",
  edit: "Edit",
  delete: "Bash",
  move: "Bash",
  search: "Grep",
  execute: "Bash",
  think: "Task",
  fetch: "WebFetch",
};

interface MastraContentBlock {
  type: string;
  text?: string;
  thinking?: string;
}

interface MastraMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content?: MastraContentBlock[];
  stopReason?: "complete" | "tool_use" | "aborted" | "error";
  errorMessage?: string;
}

export interface MastraEvent {
  type: string;
  sessionId?: string;
  message?: MastraMessage;
  toolCallId?: string;
  toolName?: string;
  args?: unknown;
  partialResult?: unknown;
  result?: unknown;
  isError?: boolean;
  error?: unknown;
  modeId?: string;
}

function stringifyResult(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    // ACP tool results use { output }, subagent delegation results use { text }
    const rec = value as { output?: unknown; text?: unknown };
    if (typeof rec.output === "string") return rec.output;
    if (typeof rec.text === "string") return rec.text;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/**
 * Apply one Mastra AgentController event to a UIMessage list.
 * Returns a new array when the event changed anything, `prev` unchanged otherwise.
 *
 * Mastra message events carry full snapshots, not deltas: message_start /
 * message_update / message_end each include the message's cumulative content,
 * so text is replaced by message id rather than appended.
 */
export function applyMastraEvent(prev: UIMessage[], event: MastraEvent): UIMessage[] {
  switch (event.type) {
    case "message_start":
    case "message_update":
    case "message_end": {
      const m = event.message;
      // User messages are already rendered by the composer send path
      if (!m || m.role !== "assistant") return prev;
      const blocks = m.content ?? [];
      const text = blocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
      const thinking = blocks.filter((b) => b.type === "thinking").map((b) => b.thinking ?? "").join("");
      const id = `mastra-msg-${m.id}`;
      const isStreaming = event.type !== "message_end";
      const idx = prev.findIndex((msg) => msg.id === id);
      if (idx < 0) {
        return [...prev, {
          id,
          role: "assistant",
          content: text,
          ...(thinking ? { thinking, thinkingComplete: !isStreaming } : {}),
          isStreaming,
          timestamp: Date.now(),
          ...(m.stopReason === "error" ? { isError: true } : {}),
        }];
      }
      const copy = [...prev];
      copy[idx] = {
        ...copy[idx],
        content: text,
        ...(thinking ? { thinking, thinkingComplete: !isStreaming } : {}),
        isStreaming,
        ...(m.stopReason === "error" ? { isError: true } : {}),
      };
      return copy;
    }

    case "tool_start": {
      const toolCallId = event.toolCallId || nextId("tool");
      const id = `mastra-tool-${toolCallId}`;
      if (prev.some((msg) => msg.id === id)) return prev;
      const args = (event.args ?? {}) as Record<string, unknown>;

      if (!isDelegationTool(event.toolName)) {
        // Regular tools (workspace reads, etc.) render as plain tool cards
        return [...prev, {
          id,
          role: "tool_call",
          content: "",
          toolName: event.toolName || "unknown",
          toolInput: args,
          timestamp: Date.now(),
        }];
      }

      // Delegation to an ACP subagent: render as a task card — agent name +
      // task in the header, inner activity streamed into subagentSteps.
      const agentName = (event.toolName ?? "agent-unknown").replace(/^agent-/, "");
      const task = typeof args.prompt === "string" ? args.prompt : String(args.task ?? "");
      return [...prev, {
        id,
        role: "tool_call",
        content: "",
        toolName: event.toolName || "unknown",
        toolInput: {
          ...args,
          subagent_type: agentName,
          description: task.length > 60 ? task.slice(0, 57) + "..." : task,
          prompt: task,
        },
        subagentId: agentName,
        subagentStatus: "running",
        subagentSteps: [],
        timestamp: Date.now(),
      }];
    }

    case "tool_update": {
      const progress = event.partialResult as MastraToolProgress | string | undefined;
      if (!progress || typeof progress === "string") return prev;

      // Progress from ACP subagents carries the agent id, not the delegation
      // tool call id — attach it to that agent's most recent running card.
      let idx = -1;
      if (event.toolCallId) {
        const directId = `mastra-tool-${event.toolCallId}`;
        idx = prev.findIndex((msg) => msg.id === directId);
      }
      if (idx < 0 && progress.agentId) {
        for (let i = prev.length - 1; i >= 0; i--) {
          const m = prev[i];
          if (m.role === "tool_call" && m.subagentStatus === "running" && m.toolName === `agent-${progress.agentId}`) {
            idx = i;
            break;
          }
        }
      }
      if (idx < 0) return prev;

      const card = prev[idx];
      if (progress.kind === "tool_start" && progress.id) {
        const steps = card.subagentSteps ?? [];
        if (steps.some((s) => s.toolUseId === progress.id)) return prev;
        const step: SubagentToolStep = {
          toolUseId: progress.id,
          toolName: ACP_KIND_TO_TOOL[progress.toolKind ?? ""] ?? progress.title ?? progress.toolKind ?? "tool",
          toolInput: {
            description: progress.title ?? "",
            ...(progress.input && typeof progress.input === "object" ? progress.input as Record<string, unknown> : {}),
          },
        };
        const copy = [...prev];
        copy[idx] = { ...card, subagentSteps: [...steps, step] };
        return copy;
      }
      if (progress.kind === "tool_end" && progress.id) {
        const steps = card.subagentSteps ?? [];
        const stepIdx = steps.findIndex((s) => s.toolUseId === progress.id);
        if (stepIdx < 0) return prev;
        const newSteps = [...steps];
        newSteps[stepIdx] = {
          ...newSteps[stepIdx],
          toolResult: { status: progress.status ?? "completed" },
          ...(progress.status === "failed" ? { toolError: true } : {}),
        };
        const copy = [...prev];
        copy[idx] = { ...card, subagentSteps: newSteps };
        return copy;
      }
      // kind === "text" (inner agent narration) has no live slot in the task
      // card — the full text arrives in the tool_end result.
      return prev;
    }

    case "tool_end": {
      if (!event.toolCallId) return prev;
      const id = `mastra-tool-${event.toolCallId}`;
      const idx = prev.findIndex((msg) => msg.id === id);
      if (idx < 0) return prev;
      const copy = [...prev];
      const card = copy[idx];
      const isDelegation = card.subagentSteps !== undefined;
      // Close out any steps the inner agent never reported as finished
      const settledSteps = isDelegation
        ? (card.subagentSteps ?? []).map((s) =>
            s.toolResult ? s : { ...s, toolResult: { status: "completed" } },
          )
        : undefined;
      copy[idx] = {
        ...card,
        toolError: !!event.isError,
        toolResult: {
          content: stringifyResult(event.result),
          status: event.isError ? "failed" : "completed",
        },
        ...(isDelegation
          ? {
              subagentStatus: "completed" as const,
              subagentSteps: settledSteps,
              subagentDurationMs: Date.now() - card.timestamp,
            }
          : {}),
      };
      return copy;
    }

    case "tool_approval_required": {
      return [...prev, {
        id: nextId("sys"),
        role: "system",
        content: `Tool call auto-approved: ${event.toolName ?? "unknown"}`,
        timestamp: Date.now(),
      }];
    }

    case "mode_changed": {
      if (!event.modeId) return prev;
      return [...prev, {
        id: nextId("sys"),
        role: "system",
        content: `Switched to ${event.modeId} mode`,
        timestamp: Date.now(),
      }];
    }

    case "error": {
      return [...prev, {
        id: nextId("sys-err"),
        role: "system",
        content: stringifyResult(event.error) || "An error occurred",
        isError: true,
        timestamp: Date.now(),
      }];
    }

    default:
      // Ignore bookkeeping events (display_state_changed, usage_update, tool_input_*, workspace_*)
      return prev;
  }
}

/** True when the event starts a Mastra run, false when it ends one, null otherwise. */
export function mastraProcessingChange(event: MastraEvent): boolean | null {
  if (event.type === "agent_start") return true;
  if (event.type === "agent_end" || event.type === "error") return false;
  return null;
}

/**
 * Process a Mastra AgentController event for a background session,
 * mutating `state` in place (same contract as the other engine handlers).
 */
export function handleMastraEvent(state: InternalState, event: MastraEvent): void {
  state.isConnected = true;
  state.messages = applyMastraEvent(state.messages, event);
  const processing = mastraProcessingChange(event);
  if (processing !== null) state.isProcessing = processing;
}
