import fs from 'fs/promises';
import path from 'path';
import { log } from './logger';

export interface SkillInfo {
  name: string;
  path: string;
  description?: string;
  scope: 'project' | 'global';
}

export class SkillManager {
  private projectPath: string;
  private globalPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.globalPath = path.join(process.env.HOME || '', '.pilot', 'skills');
  }

  async discoverSkills(): Promise<SkillInfo[]> {
    const skills: SkillInfo[] = [];
    skills.push(...await this.scanSkillDir(path.join(this.projectPath, '.pilot', 'skills'), 'project'));
    skills.push(...await this.scanSkillDir(this.globalPath, 'global'));
    return skills;
  }

  private async scanSkillDir(dir: string, scope: 'project' | 'global'): Promise<SkillInfo[]> {
    const skills: SkillInfo[] = [];
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillPath = path.join(dir, entry.name, 'SKILL.md');
          try {
            await fs.access(skillPath);
            const content = await fs.readFile(skillPath, 'utf-8');
            const descMatch = content.match(/^#\s+(.+)/m);
            skills.push({
              name: entry.name,
              path: skillPath,
              description: descMatch?.[1],
              scope,
            });
          } catch {}
        }
      }
    } catch {}
    return skills;
  }

  async getSkillManifest(): Promise<string[]> {
    const skills = await this.discoverSkills();
    return skills.map(s => s.path);
  }
}
