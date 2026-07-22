import { AgentController } from '@mastra/core/agent-controller';
import { Agent } from '@mastra/core/agent';
import type { MastraModelConfig } from '@mastra/core/llm';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { Workspace, LocalFilesystem } from '@mastra/core/workspace';
import { load as yamlLoad } from 'js-yaml';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { log } from './logger';
import { createSupervisorAgent, createPassthroughAgent, createACPSupervisorAgent, type AgentMode } from './agent-factory';
import { SkillManager } from './skill-manager';
import { resolveProviderModel } from './llm-provider-store';
import { getAppSettings } from './app-settings';
import { buildAcpMcpServers } from '../ipc/acp-sessions';
import type { McpServerInput } from '@shared/lib/mcp-config';

export type { AgentMode };

// ── Pilot config.yaml types and parsing ──

export interface PilotAgentConfig {
  command: string;
  args: string[];
  capabilities?: string[];
  strengths?: string[];
  role?: 'primary' | 'sub' | 'both';
}

export interface PilotConfig {
  supervisor?: {
    model?: string;
    /** Selectable model list shown in the engine picker (config.yaml). */
    models?: string[];
  };
  agents?: Record<string, PilotAgentConfig>;
}

/** Fallback picker list when config.yaml doesn't define supervisor.models. */
export const DEFAULT_SUPERVISOR_MODELS = ['deepseek/deepseek-chat', 'deepseek/deepseek-reasoner'];

function loadPilotConfig(projectPath: string): PilotConfig {
  try {
    const configPath = path.join(projectPath, '.pilot', 'config.yaml');
    const content = fs.readFileSync(configPath, 'utf-8');
    return yamlLoad(content) as PilotConfig;
  } catch {
    return {};
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

// One AgentController per (project, mode, agent) combination — the primary
// agent is baked in at construction, so chats running different modes need
// different controllers. A single cached instance silently served whichever
// mode initialized first.
const controllers = new Map<string, AgentController>();

function controllerKey(options: InitOptions): string {
  const mode = options.mode || 'supervisor';
  const agentPart = mode === 'direct'
    ? options.directAgentId || 'opencode'
    : mode === 'acp-supervisor'
      ? options.supervisorAgentId || 'opencode'
      : '-';
  // Model is part of the identity: sessions on different supervisor models
  // must not share a controller (its agent bakes the model in).
  return `${options.projectPath}::${mode}::${agentPart}::${options.modelOverride || 'default'}`;
}

// Model API keys live in <app root>/.env (gitignored). The GUI-launched app
// doesn't inherit shell env vars, so load them ourselves.
export function loadEnvFile(): void {
  const envPath = path.join(app.getAppPath(), '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
}

export interface InitOptions {
  projectPath: string;
  mode?: AgentMode;
  modelOverride?: string;
  directAgentId?: string;      // mode='direct' 时使用
  supervisorAgentId?: string;  // mode='acp-supervisor' 时使用
  /** Project MCP servers (renderer config shape) shared with all subagents. */
  mcpServers?: McpServerInput[];
}

export async function initMastraService(projectPathOrOptions: string | InitOptions, modelOverride?: string): Promise<AgentController> {
  // Support both old signature (projectPath, modelOverride) and new options object
  const options: InitOptions = typeof projectPathOrOptions === 'string'
    ? { projectPath: projectPathOrOptions, modelOverride }
    : projectPathOrOptions;

  const key = controllerKey(options);
  const cached = controllers.get(key);
  if (cached) return cached;

  loadEnvFile();

  const config = loadPilotConfig(options.projectPath);
  const mode = options.mode || 'supervisor';

  // Resolve the supervisor model from the saved LLM providers. The override is
  // a compound `providerId::modelId` selection from the picker; the provider
  // carries its own base URL and API key. When either is set we pass the model
  // as an OpenAI-compatible config so the provider's values win; otherwise the
  // bare `provider/model` id lets the model router resolve it from the env.
  // Per-chat pick wins; otherwise the Settings → Pilot default; otherwise the
  // first provider's first model (resolveProviderModel's own fallback).
  const appSettings = getAppSettings();
  const { provider, modelId } = resolveProviderModel(
    options.modelOverride || appSettings.pilotSupervisorModel,
  );
  const providerPrefix = provider?.id || 'deepseek';
  const fullModelId = `${providerPrefix}/${modelId}`;
  const apiKey = provider?.apiKey?.trim();
  const baseUrl = provider?.baseUrl?.trim();
  const supervisorModel: MastraModelConfig = (apiKey || baseUrl)
    ? {
        id: fullModelId as `${string}/${string}`,
        ...(apiKey ? { apiKey } : {}),
        ...(baseUrl ? { url: baseUrl } : {}),
      }
    : fullModelId;
  log('mastra-service', `Initializing in ${mode} mode with model: ${fullModelId}${apiKey ? ' (key)' : ''}${baseUrl ? ` @ ${baseUrl}` : ''}`);

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
    filesystem: new LocalFilesystem({ basePath: options.projectPath }),
  });

  // Project memory (.pilot/memory/project.md) rides along in the supervisor's
  // instructions — architecture decisions, conventions, cross-session context.
  const projectMemory = readProjectMemory(options.projectPath);

  // Project MCP servers ride into every subagent's ACP session — the same
  // list (and conversion) the direct ACP engine uses.
  let acpMcpServers: unknown[] | undefined;
  if (options.mcpServers?.length) {
    try {
      acpMcpServers = await buildAcpMcpServers(options.mcpServers);
      log('mastra-service', `Passing ${acpMcpServers.length} MCP server(s) to subagents`);
    } catch (err) {
      log('mastra-service', `MCP server conversion failed: ${err}`);
    }
  }

  // Skills catalog (.pilot/skills + ~/.pilot/skills): name, description, and
  // path per skill so the supervisor knows what exists and where to read it.
  let skillsCatalog: string | undefined;
  try {
    const skills = await new SkillManager(options.projectPath).discoverSkills();
    if (skills.length > 0) {
      skillsCatalog = 'Installed skills:\n' + skills
        .map((s) => `- ${s.name} (${s.scope}): ${s.description || 'no description'} — ${s.path}`)
        .join('\n');
      log('mastra-service', `Discovered ${skills.length} skill(s)`);
    }
  } catch (err) {
    log('mastra-service', `Skill discovery failed: ${err}`);
  }

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

  // Create the primary agent based on mode
  let primaryAgent: Agent;
  const agents = config.agents || {
    'opencode': { command: 'opencode', args: ['acp'] },
    'codex': { command: 'npx', args: ['-y', '@agentclientprotocol/codex-acp'] },
  };

  switch (mode) {
    case 'direct': {
      // Mode 2: Direct ACP - passthrough to single agent
      const agentId = options.directAgentId || 'opencode';
      const agentConfig = agents[agentId];
      if (!agentConfig) throw new Error(`Agent ${agentId} not found in config`);
      primaryAgent = createPassthroughAgent({
        acpId: agentId,
        acpCommand: agentConfig.command,
        acpArgs: agentConfig.args,
        cwd: options.projectPath,
        model: supervisorModel,
      });
      break;
    }

    case 'acp-supervisor': {
      // Mode 3: ACP Supervisor - ACP agent makes decisions via proxy
      const supervisorId = options.supervisorAgentId || 'opencode';
      const supervisorConfig = agents[supervisorId];
      if (!supervisorConfig) throw new Error(`Agent ${supervisorId} not found in config`);
      const subAgents = { ...agents };
      delete subAgents[supervisorId];
      primaryAgent = createACPSupervisorAgent({
        projectPath: options.projectPath,
        agents: subAgents,
        projectMemory,
        supervisorId,
        supervisorConfig,
        proxyModel: supervisorModel,
      });
      break;
    }

    default: {
      // Mode 1: Supervisor - Mastra makes decisions (default)
      primaryAgent = createSupervisorAgent({
        projectPath: options.projectPath,
        agents,
        projectMemory,
        skillsCatalog,
        mcpServers: acpMcpServers,
        model: supervisorModel,
        maxOutputTokens: appSettings.pilotSupervisorMaxOutputTokens,
      });
    }
  }

  const agentController = new AgentController({
    id: `pilot-controller-${mode}`,
    agent: primaryAgent,
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
  controllers.set(key, agentController);
  log('mastra-service', `Mastra service initialized in ${mode} mode (${key})`);
  return agentController;
}

/** Get the current pilot config for the project. */
export function getPilotConfig(projectPath: string): PilotConfig {
  return loadPilotConfig(projectPath);
}

export function getAgentController(): AgentController | null {
  const first = controllers.values().next();
  return first.done ? null : first.value;
}

export async function destroyMastraService(): Promise<void> {
  for (const [key, controller] of controllers) {
    try {
      await controller.destroy();
    } catch (err) {
      log('mastra-service', `Failed to destroy controller ${key}: ${err}`);
    }
  }
  controllers.clear();
  log('mastra-service', 'Mastra service destroyed');
}
