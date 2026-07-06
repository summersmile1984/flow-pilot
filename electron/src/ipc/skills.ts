import { ipcMain } from 'electron';
import { SkillManager } from '../lib/skill-manager';
import { log } from '../lib/logger';

let skillManager: SkillManager | null = null;

export function register(): void {
  ipcMain.handle('skills:init', async (_event, projectPath: string) => {
    skillManager = new SkillManager(projectPath);
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
}
