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
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('SkillManager', () => {
  let skillManager: SkillManager;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pilot-test-'));
    skillManager = new SkillManager(tmpDir);
  });

  afterEach(async () => {
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
