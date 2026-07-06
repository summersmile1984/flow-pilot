import type { InternalState } from "./session-store";
import { nextId } from "@/lib/message-factory";
import {
  ensureACPStreamingMsg,
  finalizeACPStreamingMsg,
  closePendingACPTools,
} from "./acp-handler";

interface MastraEvent {
  type: string;
  sessionId?: string;
  message?: { content?: string | Array<{ type: string; text?: string }> };
  toolName?: string;
  toolCallId?: string;
  status?: string;
  content?: unknown;
  error?: unknown;
  modeId?: string;
}

/**
 * Process a Mastra AgentController event, mutating `state` in place.
 * Converts Mastra events to UIMessages matching the ACP handler pattern.
 */
export function handleMastraEvent(state: InternalState, event: MastraEvent): void {
  state.isConnected = true;

  switch (event.type) {
    case "agent_start": {
      state.isProcessing = true;
      break;
    }

    case "message_start": {
      state.isProcessing = true;
      ensureACPStreamingMsg(state);
      break;
    }

    case "message_update": {
      ensureACPStreamingMsg(state);
      const target = state.messages.find(m => m.id === state.currentStreamingMsgId);
      if (target && event.message) {
        const content = event.message.content;
        if (typeof content === "string") {
          target.content += content;
        } else if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "text" && block.text) {
              target.content += block.text;
            } else if (block.type === "thinking" && block.text) {
              target.thinking = (target.thinking ?? "") + block.text;
            }
          }
        }
      }
      break;
    }

    case "message_end": {
      finalizeACPStreamingMsg(state);
      state.isProcessing = false;
      break;
    }

    case "tool_start": {
      closePendingACPTools(state);
      finalizeACPStreamingMsg(state);
      const toolCallId = event.toolCallId || nextId("tool");
      const msgId = `tool-${toolCallId}`;
      if (!state.messages.some(m => m.id === msgId)) {
        state.messages.push({
          id: msgId,
          role: "tool_call",
          content: "",
          toolName: event.toolName || "unknown",
          toolInput: {},
          timestamp: Date.now(),
        });
      }
      break;
    }

    case "tool_update": {
      const toolCallId = event.toolCallId;
      if (toolCallId) {
        const msgId = `tool-${toolCallId}`;
        const target = state.messages.find(m => m.id === msgId);
        if (target) {
          if (event.content) {
            target.toolResult = { content: String(event.content) };
          }
          if (event.status === "completed") {
            target.toolResult = target.toolResult || { status: "completed" };
          } else if (event.status === "failed") {
            target.toolError = true;
            target.toolResult = { status: "failed", content: String(event.error || "Tool failed") };
          }
        }
      }
      break;
    }

    case "tool_end": {
      const toolCallId = event.toolCallId;
      if (toolCallId) {
        const msgId = `tool-${toolCallId}`;
        const target = state.messages.find(m => m.id === msgId);
        if (target && !target.toolResult) {
          target.toolResult = { status: "completed" };
        }
      }
      break;
    }

    case "mode_changed": {
      if (event.modeId) {
        state.messages.push({
          id: nextId("sys"),
          role: "system",
          content: `Switched to ${event.modeId} mode`,
          timestamp: Date.now(),
        });
      }
      break;
    }

    case "error": {
      finalizeACPStreamingMsg(state);
      state.messages.push({
        id: nextId("sys-err"),
        role: "system",
        content: String(event.error || "An error occurred"),
        isError: true,
        timestamp: Date.now(),
      });
      state.isProcessing = false;
      break;
    }

    case "agent_end": {
      finalizeACPStreamingMsg(state);
      state.isProcessing = false;
      break;
    }

    default:
      // Ignore unknown events (display_state_changed, etc.)
      break;
  }
}
