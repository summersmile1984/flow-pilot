import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock pilot.skills API
const mockSkillsList = vi.fn();
const mockSkillsCreate = vi.fn();
const mockSkillsDelete = vi.fn();
const mockSkillsUpdate = vi.fn();
const mockSkillsRead = vi.fn();

// Mock window.pilot
vi.stubGlobal('window', {
  pilot: {
    skills: {
      list: mockSkillsList,
      create: mockSkillsCreate,
      delete: mockSkillsDelete,
      update: mockSkillsUpdate,
      read: mockSkillsRead,
    },
  },
});

describe('SkillManager IPC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has skills:list API available', () => {
    expect(typeof window.pilot.skills.list).toBe('function');
  });

  it('has skills:create API available', () => {
    expect(typeof window.pilot.skills.create).toBe('function');
  });

  it('has skills:delete API available', () => {
    expect(typeof window.pilot.skills.delete).toBe('function');
  });

  it('has skills:update API available', () => {
    expect(typeof window.pilot.skills.update).toBe('function');
  });

  it('has skills:read API available', () => {
    expect(typeof window.pilot.skills.read).toBe('function');
  });

  it('calls skills:list correctly', async () => {
    const skills = [
      { name: 'test-skill', path: '/path/SKILL.md', description: 'Test', scope: 'project' },
    ];
    mockSkillsList.mockResolvedValue({ success: true, skills });

    const result = await window.pilot.skills.list();
    expect(result.success).toBe(true);
    const listed = (result.skills ?? []) as Array<{ name: string }>;
    expect(listed).toHaveLength(1);
    expect(listed[0].name).toBe('test-skill');
  });

  it('calls skills:create correctly', async () => {
    mockSkillsCreate.mockResolvedValue({ success: true });

    const result = await window.pilot.skills.create({
      name: 'new-skill',
      content: '# New Skill',
      scope: 'project',
    });
    expect(result.success).toBe(true);
    expect(mockSkillsCreate).toHaveBeenCalledWith({
      name: 'new-skill',
      content: '# New Skill',
      scope: 'project',
    });
  });

  it('calls skills:delete correctly', async () => {
    mockSkillsDelete.mockResolvedValue({ success: true });

    const result = await window.pilot.skills.delete('/path/to/skill/SKILL.md');
    expect(result.success).toBe(true);
    expect(mockSkillsDelete).toHaveBeenCalledWith('/path/to/skill/SKILL.md');
  });

  it('calls skills:update correctly', async () => {
    mockSkillsUpdate.mockResolvedValue({ success: true });

    const result = await window.pilot.skills.update({
      skillPath: '/path/to/skill/SKILL.md',
      content: '# Updated Skill',
    });
    expect(result.success).toBe(true);
    expect(mockSkillsUpdate).toHaveBeenCalledWith({
      skillPath: '/path/to/skill/SKILL.md',
      content: '# Updated Skill',
    });
  });

  it('calls skills:read correctly', async () => {
    mockSkillsRead.mockResolvedValue({ success: true, content: '# Skill Content' });

    const result = await window.pilot.skills.read('/path/to/skill/SKILL.md');
    expect(result.success).toBe(true);
    expect(result.content).toBe('# Skill Content');
  });

  it('handles skills:list failure', async () => {
    mockSkillsList.mockResolvedValue({ success: false, error: 'Not initialized' });

    const result = await window.pilot.skills.list();
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not initialized');
  });

  it('handles skills:create failure', async () => {
    mockSkillsCreate.mockResolvedValue({ success: false, error: 'Creation failed' });

    const result = await window.pilot.skills.create({
      name: 'new-skill',
      content: '# New Skill',
      scope: 'project',
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Creation failed');
  });
});
