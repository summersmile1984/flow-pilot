import { AcpAgent } from '@mastra/acp';
import { createTool } from '@mastra/core/tools';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { log } from './logger';

// ── ACP session persistence ──
// ACP agents (opencode/codex) keep their own conversation context inside their
// session. Persisting the session id lets the next app launch resume it via
// ACP `session/load`, so the agents remember prior work across restarts.

function acpSessionStorePath(): string {
  return path.join(app.getPath('userData'), 'pilot-data', 'acp-sessions.json');
}

function readAcpSessionIds(): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(acpSessionStorePath(), 'utf-8')) as Record<string, string>;
  } catch {
    return {};
  }
}

function writeAcpSessionId(key: string, sessionId: string): void {
  try {
    const all = readAcpSessionIds();
    if (all[key] === sessionId) return;
    all[key] = sessionId;
    fs.mkdirSync(path.dirname(acpSessionStorePath()), { recursive: true });
    fs.writeFileSync(acpSessionStorePath(), JSON.stringify(all, null, 2));
  } catch (err) {
    log('streaming-acp', `Failed to persist ACP session id: ${err}`);
  }
}

/**
 * Resume the ACP agent's own session across app restarts: after the stock
 * initialize() creates a fresh session, call ACP `session/load` with the
 * previously persisted id (claude-agent-acp and codex-acp both advertise
 * loadSession support) and swap it in. Falls back to the fresh session when
 * the saved one is gone. Runtime patch — @mastra/acp's ACPConnection exposes
 * no resume hook of its own.
 */
function wireSessionResume(agent: AcpAgent, agentId: string, cwd: string): void {
  const conn = agent.connection as unknown as {
    initialize?: () => Promise<void>;
    connection?: { loadSession: (p: { sessionId: string; cwd: string; mcpServers: never[] }) => Promise<unknown> };
    session?: { sessionId: string };
  };
  if (typeof conn.initialize !== 'function') return;
  const storeKey = `${cwd}::${agentId}`;
  const origInit = conn.initialize.bind(conn);
  conn.initialize = async () => {
    await origInit();
    const saved = readAcpSessionIds()[storeKey];
    if (saved && saved !== conn.session?.sessionId && conn.connection?.loadSession) {
      try {
        await conn.connection.loadSession({ sessionId: saved, cwd, mcpServers: [] });
        if (conn.session) conn.session.sessionId = saved;
        log('streaming-acp', `${agentId}: resumed ACP session ${saved}`);
      } catch (err) {
        log('streaming-acp', `${agentId}: ACP session resume failed, using fresh session (${err})`);
      }
    }
    if (conn.session?.sessionId) writeAcpSessionId(storeKey, conn.session.sessionId);
  };
}

export interface StreamingACPToolOptions {
  /** Tool id as exposed to the model (use the `agent-<id>` convention). */
  id: string;
  /** The underlying ACP agent id (used for session persistence and progress). */
  agentId: string;
  description: string;
  command: string;
  args: string[];
  cwd: string;
  /** Model to select on the ACP session (session/set_model), when supported. */
  model?: string;
}

/**
 * Wrap an ACP CLI agent as a Mastra tool that streams the agent's inner
 * activity while it runs. Stock `createACPTool` awaits the final text and
 * discards all progress; this version forwards each inner event as a
 * `data-mastracode-tool-progress` chunk via the tool writer, which the
 * AgentController turns into `tool_update` events — the renderer shows them
 * as live steps on the delegation task card. Also wires cross-restart ACP
 * session resume.
 */
export function createStreamingACPTool(options: StreamingACPToolOptions) {
  const acpAgent = new AcpAgent({
    id: options.agentId,
    description: options.description,
    command: options.command,
    args: options.args,
    cwd: options.cwd,
    model: options.model,
  });
  wireSessionResume(acpAgent, options.agentId, options.cwd);

  return createTool({
    id: options.id,
    description: options.description,
    inputSchema: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'The task to send to the ACP agent' },
      },
      required: ['task'],
    } as const,
    outputSchema: {
      type: 'object',
      properties: {
        output: { type: 'string', description: 'The output of the ACP agent' },
      },
      required: ['output'],
    } as const,
    execute: async ({ task }: { task: string }, context) => {
      const writer = context?.writer as
        | { callId?: string; custom?: (data: unknown) => Promise<void> }
        | undefined;
      const outerCallId = writer?.callId;
      const report = async (progress: Record<string, unknown>) => {
        if (!writer?.custom || !outerCallId) return;
        try {
          await writer.custom({
            type: 'data-mastracode-tool-progress',
            data: { toolCallId: outerCallId, progress: { agentId: options.agentId, ...progress } },
          });
        } catch {
          // progress is best-effort; never fail the delegation over it
        }
      };

      const chunks: string[] = [];
      for await (const event of acpAgent.connection.promptStream(task, context?.abortSignal)) {
        if (event.type === 'text') {
          chunks.push(event.text);
          await report({ kind: 'text', text: event.text });
        } else if (event.type === 'session-update') {
          const u = event.update as {
            sessionUpdate?: string;
            toolCallId?: string;
            title?: string;
            kind?: string;
            status?: string;
            rawInput?: unknown;
          };
          if (u.sessionUpdate === 'tool_call') {
            await report({
              kind: 'tool_start',
              id: u.toolCallId,
              title: u.title,
              toolKind: u.kind,
              input: u.rawInput,
            });
          } else if (
            u.sessionUpdate === 'tool_call_update' &&
            (u.status === 'completed' || u.status === 'failed')
          ) {
            await report({ kind: 'tool_end', id: u.toolCallId, status: u.status });
          }
        }
      }
      return { output: chunks.join('') };
    },
  });
}
