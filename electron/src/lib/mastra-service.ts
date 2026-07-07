import { AgentController } from '@mastra/core/agent-controller';
import { Agent } from '@mastra/core/agent';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { AcpAgent } from '@mastra/acp';
import { Workspace, LocalFilesystem } from '@mastra/core/workspace';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { log } from './logger';

// ── ACP session persistence (fix: resume claude-code/codex context across app restarts) ──

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
    log('mastra-service', `Failed to persist ACP session id: ${err}`);
  }
}

/** Read the project memory file maintained under .pilot/memory/project.md. */
function readProjectMemory(projectPath: string): string {
  try {
    return fs.readFileSync(path.join(projectPath, '.pilot', 'memory', 'project.md'), 'utf-8').trim();
  } catch {
    return '';
  }
}

/**
 * AcpAgent subclass that makes the ACP agent's inner activity visible when it
 * runs as a Mastra subagent. The delegation tool (`agent-<id>`) forwards only
 * `data-*` chunks from the subagent's stream to the AgentController, so we
 * translate the inner tool-call / tool-result chunks into
 * `data-mastracode-tool-progress` chunks — those surface as `tool_update`
 * events and render as live steps on the delegation card.
 */
class StreamingAcpAgent extends AcpAgent {
  /** Parent-injected memory — used by the delegation tool to persist sub-threads. */
  private injectedMemory: unknown;

  constructor(options: ConstructorParameters<typeof AcpAgent>[0]) {
    super(options);
    this.wireSessionResume(options.id, options.cwd ?? process.cwd());
  }

  /**
   * The delegation tool injects the parent agent's memory into subagents that
   * have none (so sub-conversations persist as LibSQL sub-threads). Stock
   * AcpAgent implements __setMemory as a no-op and getMemory as undefined,
   * which silently drops the injection — store and return it instead.
   */
  override __setMemory(memory: Parameters<AcpAgent['__setMemory']>[0]): void {
    this.injectedMemory = memory;
  }

  override getMemory(): undefined {
    return this.injectedMemory as undefined;
  }

  /**
   * Resume the ACP agent's own session across app restarts: after the stock
   * initialize() creates a fresh session, call ACP `session/load` with the
   * previously persisted session id (both claude-agent-acp and codex-acp
   * advertise loadSession support) and swap it in. Falls back to the fresh
   * session when the saved one is gone. Runtime patch — @mastra/acp's
   * ACPConnection has no resume hook of its own.
   */
  private wireSessionResume(agentId: string, cwd: string): void {
    const conn = this.connection as unknown as {
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
          log('mastra-service', `${agentId}: resumed ACP session ${saved}`);
        } catch (err) {
          log('mastra-service', `${agentId}: ACP session resume failed, using fresh session (${err})`);
        }
      }
      if (conn.session?.sessionId) writeAcpSessionId(storeKey, conn.session.sessionId);
    };
  }

  async stream(
    messages: Parameters<AcpAgent['stream']>[0],
    options?: Parameters<AcpAgent['stream']>[1],
  ): ReturnType<AcpAgent['stream']> {
    const result = await super.stream(messages, options);
    const agentId = this.id;
    const source = result.fullStream;

    const fullStream = new ReadableStream({
      async start(controller) {
        const reader = source.getReader();
        const report = (progress: Record<string, unknown>) => {
          controller.enqueue({
            type: 'data-mastracode-tool-progress',
            runId: result.runId,
            from: 'AGENT',
            data: { toolCallId: `acp:${agentId}`, progress: { agentId, ...progress } },
          } as unknown as Parameters<typeof controller.enqueue>[0]);
        };
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = value as { type?: string; payload?: { toolCallId?: string; toolName?: string; args?: unknown; isError?: boolean } };
            if (chunk.type === 'tool-call' && chunk.payload?.toolCallId) {
              report({
                kind: 'tool_start',
                id: chunk.payload.toolCallId,
                title: chunk.payload.toolName,
                input: chunk.payload.args,
              });
            } else if (chunk.type === 'tool-result' && chunk.payload?.toolCallId) {
              report({
                kind: 'tool_end',
                id: chunk.payload.toolCallId,
                status: chunk.payload.isError ? 'failed' : 'completed',
              });
            }
            controller.enqueue(value);
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return { ...result, fullStream };
  }
}

let agentController: AgentController | null = null;

// Model API keys live in <app root>/.env (gitignored). The GUI-launched app
// doesn't inherit shell env vars, so load them ourselves.
function loadEnvFile(): void {
  const envPath = path.join(app.getAppPath(), '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
}

export async function initMastraService(projectPath: string): Promise<AgentController> {
  if (agentController) return agentController;

  loadEnvFile();

  const dataDir = path.join(app.getPath('userData'), 'pilot-data');
  const dbPath = path.join(dataDir, 'pilot.db');

  // Ensure database directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const storage = new LibSQLStore({ id: 'pilot-store', url: `file:${dbPath}` });

  // Create workspace with project filesystem
  const workspace = new Workspace({
    id: 'pilot-workspace',
    filesystem: new LocalFilesystem({ basePath: projectPath }),
  });

  // ACP CLI agents registered as Mastra subagents: the AgentController is the
  // orchestration layer, each ACP agent keeps its own internal capabilities.
  const claudeCodeAgent = new StreamingAcpAgent({
    id: 'claude-code',
    name: 'Claude Code',
    description: 'Claude Code agent for complex refactoring, multi-file changes, and architecture decisions',
    command: 'npx',
    args: ['-y', '@agentclientprotocol/claude-agent-acp'],
    cwd: projectPath,
    workspace,
  });

  const codexAgent = new StreamingAcpAgent({
    id: 'codex',
    name: 'Codex',
    description: 'Codex agent for test generation, quick fixes, and simple implementations',
    command: 'npx',
    args: ['-y', '@agentclientprotocol/codex-acp'],
    cwd: projectPath,
    workspace,
  });

  // Project memory (.pilot/memory/project.md) rides along in the supervisor's
  // instructions — architecture decisions, conventions, cross-session context.
  const projectMemory = readProjectMemory(projectPath);

  // Conversation persistence: messages go to LibSQL so resumed sessions carry
  // their history and delegation sub-threads are recorded. Semantic recall and
  // working memory stay off (no embedder configured). The instance is shared:
  // the AgentController persists the main thread, while the supervisor agent
  // needs it directly for delegation sub-thread saves (agent.getMemory()).
  const memory = new Memory({
    storage,
    options: {
      lastMessages: 30,
      semanticRecall: false,
      workingMemory: { enabled: false },
    },
  });

  const supervisorAgent = new Agent({
    id: 'supervisor',
    name: 'Supervisor',
    description: 'Routes coding tasks to the best ACP subagent',
    instructions: `You are a supervisor agent that delegates coding tasks to specialized subagents.
- Use the \`agent-claude-code\` tool for complex refactoring, multi-file changes, architecture decisions
- Use the \`agent-codex\` tool for test generation, quick fixes, simple implementations
- Write clear, self-contained prompts — subagents do not see this conversation
- You can delegate to multiple subagents in parallel for independent subtasks${
      projectMemory ? `\n\n## Project memory (.pilot/memory/project.md)\n${projectMemory}` : ''
    }`,
    model: 'deepseek/deepseek-chat',
    memory,
    agents: {
      'claude-code': claudeCodeAgent,
      'codex': codexAgent,
    },
  });

  agentController = new AgentController({
    id: 'pilot-controller',
    agent: supervisorAgent,
    storage,
    memory,
    workspace,
    modes: [
      {
        id: 'plan',
        name: 'Plan',
        instructions: 'Reason about changes before making them. Do not execute code.',
        metadata: { default: true },
      },
      {
        id: 'build',
        name: 'Build',
        instructions: 'Execute code changes using the available tools.',
        transitionsTo: 'plan',
      },
      {
        id: 'review',
        name: 'Review',
        instructions: 'Review code changes and provide feedback. Read-only mode.',
      },
    ],
  });

  await agentController.init();
  log('mastra-service', 'Mastra service initialized');
  return agentController;
}

export function getAgentController(): AgentController | null {
  return agentController;
}

export async function destroyMastraService(): Promise<void> {
  if (agentController) {
    await agentController.destroy();
    agentController = null;
    log('mastra-service', 'Mastra service destroyed');
  }
}
