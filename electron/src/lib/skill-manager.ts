import fs from 'fs/promises';
import path from 'path';
import { log } from './logger';
import { seedBuiltinSkills } from './builtin-skills';

export interface SkillInfo {
  name: string;
  path: string;
  description?: string;
  scope: 'project' | 'global';
}

export class SkillManager {
  private projectPath: string | null;
  private globalPath: string;

  /** `projectPath: null` manages global skills only (no project open). */
  constructor(projectPath: string | null) {
    this.projectPath = projectPath;
    this.globalPath = path.join(process.env.HOME || '', '.pilot', 'skills');
  }

  async discoverSkills(): Promise<SkillInfo[]> {
    // First discovery on a fresh install seeds the bundled starter skills
    // into the global dir (idempotent; never overwrites or resurrects).
    await seedBuiltinSkills();
    const skills: SkillInfo[] = [];
    if (this.projectPath) {
      skills.push(...await this.scanSkillDir(path.join(this.projectPath, '.pilot', 'skills'), 'project'));
    }
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
