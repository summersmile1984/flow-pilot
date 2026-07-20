import { ipcMain } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { SkillManager } from '../lib/skill-manager';
import { log } from '../lib/logger';

let skillManager: SkillManager | null = null;
let currentProjectPath: string | null = null;

export function register(): void {
  ipcMain.handle('skills:init', async (_event, projectPath: string) => {
    skillManager = new SkillManager(projectPath);
    currentProjectPath = projectPath;
    log('skills-ipc', `Initialized for ${projectPath}`);
    return { success: true };
  });

  ipcMain.handle('skills:list', async () => {
    if (!skillManager) return { success: false, error: 'Not initialized' };
    const skills = await skillManager.discoverSkills();
    return { success: true, skills };
  });

  ipcMain.handle('skills:manifest', async () => {
    if (!skillManager) return { success: false, error: 'Not initialized' };
    const manifest = await skillManager.getSkillManifest();
    return { success: true, manifest };
  });

  ipcMain.handle('skills:create', async (_event, { name, content, scope }: { name: string; content: string; scope: 'project' | 'global' }) => {
    if (!currentProjectPath) return { success: false, error: 'Not initialized' };
    try {
      const baseDir = scope === 'project'
        ? path.join(currentProjectPath, '.pilot', 'skills', name)
        : path.join(process.env.HOME || '', '.pilot', 'skills', name);
      await fs.mkdir(baseDir, { recursive: true });
      await fs.writeFile(path.join(baseDir, 'SKILL.md'), content, 'utf-8');
      log('skills-ipc', `Created skill: ${name} (${scope})`);
      // Refresh skill manager
      if (skillManager && currentProjectPath) {
        skillManager = new SkillManager(currentProjectPath);
      }
      return { success: true };
    } catch (err) {
      log('skills-ipc', `Create failed: ${err}`);
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('skills:delete', async (_event, skillPath: string) => {
    try {
      await fs.rm(path.dirname(skillPath), { recursive: true, force: true });
      log('skills-ipc', `Deleted skill: ${skillPath}`);
      // Refresh skill manager
      if (skillManager && currentProjectPath) {
        skillManager = new SkillManager(currentProjectPath);
      }
      return { success: true };
    } catch (err) {
      log('skills-ipc', `Delete failed: ${err}`);
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('skills:update', async (_event, { skillPath, content }: { skillPath: string; content: string }) => {
    try {
      await fs.writeFile(skillPath, content, 'utf-8');
      log('skills-ipc', `Updated skill: ${skillPath}`);
      return { success: true };
    } catch (err) {
      log('skills-ipc', `Update failed: ${err}`);
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('skills:read', async (_event, skillPath: string) => {
    try {
      const content = await fs.readFile(skillPath, 'utf-8');
      return { success: true, content };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
}
