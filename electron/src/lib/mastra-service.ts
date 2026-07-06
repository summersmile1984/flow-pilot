import { AgentController } from '@mastra/core/agent-controller';
import { Agent } from '@mastra/core/agent';
import { LibSQLStore } from '@mastra/libsql';
import { createACPTool } from '@mastra/acp';
import path from 'path';
import { app } from 'electron';
import { log } from './logger';

let agentController: AgentController | null = null;

export async function initMastraService(projectPath: string): Promise<AgentController> {
  if (agentController) return agentController;

  const dataDir = path.join(app.getPath('userData'), 'pilot-data');
  const dbPath = path.join(dataDir, 'pilot.db');
  const storage = new LibSQLStore({ id: 'pilot-store', url: `file:${dbPath}` });

  const claudeCodeTool = createACPTool({
    id: 'claude-code',
    description: 'Claude Code agent for complex refactoring, multi-file changes, and architecture decisions',
    command: 'npx',
    args: ['-y', '@agentclientprotocol/claude-agent-acp'],
    cwd: projectPath,
  });

  const codexTool = createACPTool({
    id: 'codex',
    description: 'Codex agent for test generation, quick fixes, and simple implementations',
    command: 'codex',
    args: ['--acp'],
    cwd: projectPath,
  });

  const supervisorAgent = new Agent({
    id: 'supervisor',
    name: 'Supervisor',
    description: 'Routes coding tasks to the best ACP agent',
    instructions: `You are a supervisor agent that routes coding tasks to the best tool.
- Use claude-code for complex refactoring, multi-file changes, architecture decisions
- Use codex for test generation, quick fixes, simple implementations
- You can call multiple tools in parallel for independent subtasks`,
    model: 'anthropic/claude-sonnet-4-20250514',
    tools: {
      'claude-code': claudeCodeTool,
      'codex': codexTool,
    },
  });

  agentController = new AgentController({
    id: 'pilot-controller',
    agent: supervisorAgent,
    storage,
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
