import fs from 'fs/promises';
import path from 'path';
import { log } from './logger';

export class MemoryManager {
  private memoryDir: string;
  private projectMemoryPath: string;

  constructor(private projectPath: string) {
    this.memoryDir = path.join(projectPath, '.pilot', 'memory');
    this.projectMemoryPath = path.join(this.memoryDir, 'project.md');
  }

  async readProjectMemory(): Promise<string> {
    try {
      return await fs.readFile(this.projectMemoryPath, 'utf-8');
    } catch {
      return '';
    }
  }

  async writeProjectMemory(content: string): Promise<void> {
    await fs.mkdir(this.memoryDir, { recursive: true });
    await fs.writeFile(this.projectMemoryPath, content, 'utf-8');
    log('memory-manager', 'Project memory updated');
  }

  async appendMemory(section: string, content: string): Promise<void> {
    const existing = await this.readProjectMemory();
    const sectionHeader = `## ${section}`;
    const sectionRegex = new RegExp(`(${sectionHeader}[\\s\\S]*?)(?=## |$)`);
    const match = existing.match(sectionRegex);

    if (match) {
      const updated = existing.replace(sectionRegex, `${match[1]}\n${content}\n`);
      await this.writeProjectMemory(updated);
    } else {
      await this.writeProjectMemory(`${existing}\n\n${sectionHeader}\n${content}\n`);
    }
  }
}
