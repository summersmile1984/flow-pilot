import { Agent } from '@mastra/core/agent';
import { createStreamingACPTool } from './streaming-acp-tool';
import type { PilotAgentConfig } from './mastra-service';

export type AgentMode = 'supervisor' | 'direct' | 'acp-supervisor';

export interface AgentFactoryOptions {
  projectPath: string;
  agents: Record<string, PilotAgentConfig>;
  projectMemory?: string;
}

/**
 * 模式 1: Supervisor Agent (Mastra 做决策)
 * 用于通用场景，成本低
 */
export function createSupervisorAgent(options: AgentFactoryOptions & { model: string }): Agent {
  const acpTools: Record<string, ReturnType<typeof createStreamingACPTool>> = {};

  for (const [id, config] of Object.entries(options.agents)) {
    acpTools[`agent-${id}`] = createStreamingACPTool({
      id: `agent-${id}`,
      agentId: id,
      description: `${id} agent - ${(config.strengths || []).join(', ')}`,
      command: config.command,
      args: config.args,
      cwd: options.projectPath,
    });
  }

  const agentList = Object.entries(options.agents)
    .map(([id, config]) => `- \`agent-${id}\`: ${(config.strengths || []).join(', ')}`)
    .join('\n');

  return new Agent({
    id: 'supervisor',
    name: 'Supervisor',
    description: 'Routes coding tasks to the best ACP subagent',
    instructions: `You are a supervisor agent that delegates coding tasks to specialized subagents.

Available agents:
${agentList}

Guidelines:
- Choose the best agent based on task requirements and agent strengths
- Write clear, self-contained prompts — subagents do not see this conversation
- You can delegate to multiple subagents in parallel for independent subtasks
- When you need the user to clarify requirements or pick between options, call the \`ask_user\` tool (question + options, single_select or multi_select) instead of writing the choices as plain text, then wait for the answer before proceeding${
      options.projectMemory ? `\n\n## Project memory (.pilot/memory/project.md)\n${options.projectMemory}` : ''
    }`,
    model: options.model,
    tools: acpTools,
  });
}

/**
 * 模式 2: Passthrough Agent (直接对话)
 * 用于直接与单个 ACP agent 对话，无委托
 */
export function createPassthroughAgent(options: {
  acpId: string;
  acpCommand: string;
  acpArgs: string[];
  cwd: string;
  model?: string;
}): Agent {
  const toolName = `agent-${options.acpId}`;
  const acpTool = createStreamingACPTool({
    id: toolName,
    agentId: options.acpId,
    description: `Direct access to ${options.acpId}`,
    command: options.acpCommand,
    args: options.acpArgs,
    cwd: options.cwd,
  });

  return new Agent({
    id: `passthrough-${options.acpId}`,
    name: options.acpId,
    description: `Direct ${options.acpId} agent`,
    instructions: `You are a transparent relay with NO identity, NO knowledge, and NO opinions of your own.

STRICT PROTOCOL — no exceptions:
1. For EVERY user message, your first and only action is to call the \`${toolName}\` tool with the user's message passed through verbatim as the task.
2. NEVER answer from your own knowledge, even for trivial or identity questions ("who are you", greetings, one-word replies) — the ${options.acpId} agent must answer them, not you.
3. After the tool returns, output the tool's result as-is. No commentary, no reformatting, no additions.`,
    model: options.model || 'deepseek/deepseek-chat',
    tools: {
      [toolName]: acpTool,
    },
  });
}

/**
 * 模式 3: ACP Supervisor Agent (ACP agent 做决策)
 * 用于需要 ACP agent 的推理能力做决策
 * 使用同模型 proxy 理解 supervisor ACP agent 的响应
 */
export function createACPSupervisorAgent(options: AgentFactoryOptions & {
  supervisorId: string;
  supervisorConfig: PilotAgentConfig;
  proxyModel: string;
}): Agent {
  // Supervisor ACP tool (主决策者)
  const supervisorToolName = `agent-${options.supervisorId}`;
  const supervisorTool = createStreamingACPTool({
    id: supervisorToolName,
    agentId: options.supervisorId,
    description: `Main supervisor agent (${options.supervisorId})`,
    command: options.supervisorConfig.command,
    args: options.supervisorConfig.args,
    cwd: options.projectPath,
  });

  // Sub-agent ACP tools (可被委托)
  const subTools: Record<string, ReturnType<typeof createStreamingACPTool>> = {};
  const subAgentList: string[] = [];

  for (const [id, config] of Object.entries(options.agents)) {
    if (id === options.supervisorId) continue; // Skip supervisor itself
    subTools[`agent-${id}`] = createStreamingACPTool({
      id: `agent-${id}`,
      agentId: id,
      description: `Sub-agent: ${id} - ${(config.strengths || []).join(', ')}`,
      command: config.command,
      args: config.args,
      cwd: options.projectPath,
    });
    subAgentList.push(`- \`agent-${id}\`: ${(config.strengths || []).join(', ')}`);
  }

  return new Agent({
    id: `acp-supervisor-${options.supervisorId}`,
    name: `${options.supervisorId} (Supervisor)`,
    description: `ACP supervisor agent: ${options.supervisorId}`,
    instructions: `You are a proxy agent for the ${options.supervisorId} supervisor.

WORKFLOW:
1. Forward ALL user messages to the \`${supervisorToolName}\` tool
2. Return the supervisor's response directly to the user
3. If the supervisor's response explicitly requests delegation to another agent, use that agent's tool
4. Do NOT add commentary or analysis — just forward responses

Available sub-agents for delegation:
${subAgentList.join('\n') || '(none)'}${
      options.projectMemory ? `\n\n## Project memory (.pilot/memory/project.md)\n${options.projectMemory}` : ''
    }`,
    model: options.proxyModel,
    tools: {
      [supervisorToolName]: supervisorTool,
      ...subTools,
    },
  });
}
