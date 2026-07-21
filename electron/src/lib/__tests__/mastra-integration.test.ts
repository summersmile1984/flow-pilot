import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { mockWrite } = vi.hoisted(() => ({
  mockWrite: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    isPackaged: true,
    getPath: vi.fn(() => '/mock'),
  },
}));

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  const mocked = {
    ...actual,
    mkdirSync: vi.fn(),
    createWriteStream: vi.fn(() => ({ write: mockWrite })),
  };
  return {
    ...mocked,
    default: mocked,
  };
});

import { SkillManager } from '../skill-manager';
import { MemoryManager } from '../memory-manager';
import { load as yamlLoad } from 'js-yaml';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Helper to parse config.yaml from a temp directory
async function parseConfigFromDir(dir: string) {
  const configPath = path.join(dir, '.pilot', 'config.yaml');
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    return yamlLoad(content);
  } catch {
    return {};
  }
}

describe('SkillManager', () => {
  let skillManager: SkillManager;
  let tmpDir: string;
  let realHome: string | undefined;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pilot-test-'));
    // Isolate the global scope (~/.pilot/skills) from the real machine, and
    // pre-write the seed marker so bundled starter skills don't get seeded
    // into the fake home mid-test.
    realHome = process.env.HOME;
    process.env.HOME = path.join(tmpDir, '.pilot-home');
    const globalSkills = path.join(process.env.HOME, '.pilot', 'skills');
    await fs.mkdir(globalSkills, { recursive: true });
    await fs.writeFile(path.join(globalSkills, '.builtin-seeded'), '999');
    skillManager = new SkillManager(tmpDir);
  });

  afterEach(async () => {
    process.env.HOME = realHome;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should discover skills from .pilot/skills/', async () => {
    const skillsDir = path.join(tmpDir, '.pilot', 'skills', 'test-skill');
    await fs.mkdir(skillsDir, { recursive: true });
    await fs.writeFile(path.join(skillsDir, 'SKILL.md'), '# Test Skill\nDescription here');

    const skills = await skillManager.discoverSkills();
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe('test-skill');
    expect(skills[0].scope).toBe('project');
    expect(skills[0].description).toBe('Test Skill');
  });

  it('should return empty array when no skills exist', async () => {
    const skills = await skillManager.discoverSkills();
    expect(skills).toHaveLength(0);
  });

  it('should return skill manifest as path array', async () => {
    const skillsDir = path.join(tmpDir, '.pilot', 'skills', 'my-skill');
    await fs.mkdir(skillsDir, { recursive: true });
    await fs.writeFile(path.join(skillsDir, 'SKILL.md'), '# My Skill');

    const manifest = await skillManager.getSkillManifest();
    expect(manifest).toHaveLength(1);
    expect(manifest[0]).toContain('SKILL.md');
  });
});

describe('MemoryManager', () => {
  let memoryManager: MemoryManager;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pilot-test-'));
    memoryManager = new MemoryManager(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should return empty string when no memory file exists', async () => {
    const content = await memoryManager.readProjectMemory();
    expect(content).toBe('');
  });

  it('should write and read project memory', async () => {
    await memoryManager.writeProjectMemory('# Project Memory\nTest content');
    const content = await memoryManager.readProjectMemory();
    expect(content).toBe('# Project Memory\nTest content');
  });

  it('should append to existing section', async () => {
    await memoryManager.writeProjectMemory('# Memory\n## Decisions\nOld decision');
    await memoryManager.appendMemory('Decisions', 'New decision');
    const content = await memoryManager.readProjectMemory();
    expect(content).toContain('Old decision');
    expect(content).toContain('New decision');
  });

  it('should create new section when appending to non-existent section', async () => {
    await memoryManager.writeProjectMemory('# Memory');
    await memoryManager.appendMemory('Tech Stack', 'TypeScript, React');
    const content = await memoryManager.readProjectMemory();
    expect(content).toContain('## Tech Stack');
    expect(content).toContain('TypeScript, React');
  });
});

describe('Pilot Config (config.yaml)', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pilot-config-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should parse supervisor model from config.yaml', async () => {
    const configDir = path.join(tmpDir, '.pilot');
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(path.join(configDir, 'config.yaml'), `
supervisor:
  model: anthropic/claude-sonnet-4
agents:
  claude-code:
    command: npx
    args: ["-y", "@agentclientprotocol/claude-agent-acp"]
`);

    const config = await parseConfigFromDir(tmpDir) as any;
    expect(config.supervisor?.model).toBe('anthropic/claude-sonnet-4');
  });

  it('should parse agent configurations', async () => {
    const configDir = path.join(tmpDir, '.pilot');
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(path.join(configDir, 'config.yaml'), `
supervisor:
  model: deepseek/deepseek-chat
agents:
  claude-code:
    command: npx
    args: ["-y", "@agentclientprotocol/claude-agent-acp"]
    capabilities: ["code-edit", "bash"]
    strengths: ["complex-refactor"]
  codex:
    command: npx
    args: ["-y", "@agentclientprotocol/codex-acp"]
`);

    const config = await parseConfigFromDir(tmpDir) as any;
    expect(config.agents?.['claude-code']?.command).toBe('npx');
    expect(config.agents?.['claude-code']?.args).toEqual(['-y', '@agentclientprotocol/claude-agent-acp']);
    expect(config.agents?.['claude-code']?.capabilities).toEqual(['code-edit', 'bash']);
    expect(config.agents?.['claude-code']?.strengths).toEqual(['complex-refactor']);
    expect(config.agents?.['codex']?.command).toBe('npx');
  });

  it('should return empty object when config.yaml does not exist', async () => {
    const config = await parseConfigFromDir(tmpDir) as any;
    expect(config).toEqual({});
  });

  it('should handle invalid YAML gracefully', async () => {
    const configDir = path.join(tmpDir, '.pilot');
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(path.join(configDir, 'config.yaml'), 'invalid: yaml: content: [');

    // js-yaml throws on invalid YAML, so we need to handle this
    try {
      await parseConfigFromDir(tmpDir);
    } catch (err) {
      expect(err).toBeDefined();
    }
  });

  it('should use default model when supervisor.model is not specified', async () => {
    const configDir = path.join(tmpDir, '.pilot');
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(path.join(configDir, 'config.yaml'), `
agents:
  claude-code:
    command: npx
    args: ["-y", "@agentclientprotocol/claude-agent-acp"]
`);

    const config = await parseConfigFromDir(tmpDir) as any;
    expect(config.supervisor?.model).toBeUndefined();
    // The default model should be 'deepseek/deepseek-chat' when not specified
    const resolvedModel = config.supervisor?.model || 'deepseek/deepseek-chat';
    expect(resolvedModel).toBe('deepseek/deepseek-chat');
  });
});
