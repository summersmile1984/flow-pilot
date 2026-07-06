import { ipcMain } from 'electron';
import { MemoryManager } from '../lib/memory-manager';
import { log } from '../lib/logger';

let memoryManager: MemoryManager | null = null;

export function register(): void {
  ipcMain.handle('memory:init', async (_event, projectPath: string) => {
    memoryManager = new MemoryManager(projectPath);
    log('memory-ipc', `Initialized for ${projectPath}`);
    return { success: true };
  });

  ipcMain.handle('memory:read', async () => {
    if (!memoryManager) return { success: false, error: 'Not initialized' };
    const content = await memoryManager.readProjectMemory();
    return { success: true, content };
  });

  ipcMain.handle('memory:write', async (_event, content: string) => {
    if (!memoryManager) return { success: false, error: 'Not initialized' };
    await memoryManager.writeProjectMemory(content);
    return { success: true };
  });

  ipcMain.handle('memory:append', async (_event, section: string, content: string) => {
    if (!memoryManager) return { success: false, error: 'Not initialized' };
    await memoryManager.appendMemory(section, content);
    return { success: true };
  });
}
