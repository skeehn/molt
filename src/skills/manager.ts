/**
 * Skills Manager
 *
 * Manages two skill formats:
 *   ~/.grain/skills/*.md   — human-authored context snippets, always injected
 *   ~/.grain/skills/*.json — machine-learned patterns, keyword-matched
 */

import fs from 'fs/promises';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import type {
  Skill,
  MarkdownSkill,
  SkillMatch,
  CreateSkillConfig,
  SkillExample,
} from './types.js';

// ─── YAML frontmatter parser (no deps) ────────────────────────────────────────

function parseFrontmatter(raw: string): { meta: Record<string, any>; body: string } {
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!fmMatch) return { meta: {}, body: raw };

  const meta: Record<string, any> = {};
  for (const line of fmMatch[1].split(/\r?\n/)) {
    const colon = line.indexOf(':');
    if (colon < 1) continue;
    const key = line.slice(0, colon).trim();
    let val: any = line.slice(colon + 1).trim();

    // Inline list: [a, b, c]
    const inlineArr = val.match(/^\[(.*)\]$/);
    if (inlineArr) {
      val = inlineArr[1].split(',').map((s: string) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    }
    // String val
    else {
      val = val.replace(/^["']|["']$/g, '');
    }
    meta[key] = val;
  }
  return { meta, body: fmMatch[2] };
}

// ─── SkillManager ──────────────────────────────────────────────────────────────

export class SkillManager {
  private jsonSkills: Map<string, Skill> = new Map();
  private mdSkills: Map<string, MarkdownSkill> = new Map();
  private skillsDir: string;
  private initialized = false;

  constructor(skillsDir?: string) {
    this.skillsDir = skillsDir || path.join(os.homedir(), '.grain', 'skills');
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await fs.mkdir(this.skillsDir, { recursive: true });
    await this.loadAll();
    this.initialized = true;
  }

  private async loadAll(): Promise<void> {
    let files: string[] = [];
    try { files = await fs.readdir(this.skillsDir); } catch { return; }

    for (const file of files) {
      const fp = path.join(this.skillsDir, file);
      if (file.endsWith('.md')) {
        try {
          const raw = await fs.readFile(fp, 'utf-8');
          const { meta, body } = parseFrontmatter(raw);
          const skill: MarkdownSkill = {
            name: path.basename(file, '.md'),
            description: meta.description || '',
            tags: Array.isArray(meta.tags) ? meta.tags : (meta.tags ? [meta.tags] : []),
            content: body.trim(),
            filePath: fp,
          };
          this.mdSkills.set(skill.name, skill);
        } catch { /* skip bad files */ }
      } else if (file.endsWith('.json')) {
        try {
          const raw = await fs.readFile(fp, 'utf-8');
          const skill: Skill = JSON.parse(raw);
          this.jsonSkills.set(skill.id, skill);
        } catch { /* skip bad files */ }
      }
    }
  }

  /** Returns Markdown skills block to always inject into system prompt */
  async getMarkdownContext(): Promise<string> {
    await this.initialize();
    if (this.mdSkills.size === 0) return '';

    const parts: string[] = ['## Skills\n'];
    for (const skill of this.mdSkills.values()) {
      parts.push(`### ${skill.name}${skill.description ? ` — ${skill.description}` : ''}`);
      parts.push(skill.content);
      parts.push('');
    }
    return parts.join('\n');
  }

  /** Returns list of all Markdown skills (for CLI display) */
  async listMarkdownSkills(): Promise<MarkdownSkill[]> {
    await this.initialize();
    return Array.from(this.mdSkills.values());
  }

  /** Get a Markdown skill by name */
  async getMarkdownSkill(name: string): Promise<MarkdownSkill | undefined> {
    await this.initialize();
    return this.mdSkills.get(name);
  }

  /** Create a Markdown skill */
  async createMarkdownSkill(name: string, description: string, content: string, tags: string[] = []): Promise<MarkdownSkill> {
    await this.initialize();
    const slug = name.toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-');
    const fp = path.join(this.skillsDir, `${slug}.md`);

    const tagsLine = tags.length > 0 ? `\ntags: [${tags.join(', ')}]` : '';
    const raw = `---\ndescription: ${description}${tagsLine}\n---\n\n${content.trim()}\n`;
    writeFileSync(fp, raw, 'utf-8');

    const skill: MarkdownSkill = { name: slug, description, tags, content: content.trim(), filePath: fp };
    this.mdSkills.set(slug, skill);
    return skill;
  }

  /** Delete a Markdown skill by name */
  async deleteMarkdownSkill(name: string): Promise<boolean> {
    await this.initialize();
    const skill = this.mdSkills.get(name);
    if (!skill) return false;
    try {
      await fs.unlink(skill.filePath);
      this.mdSkills.delete(name);
      return true;
    } catch {
      return false;
    }
  }

  // ─── JSON skill methods (machine-learned) ──────────────────────────────────

  async matchSkills(input: string, threshold = 0.6): Promise<SkillMatch[]> {
    await this.initialize();
    const matches: SkillMatch[] = [];
    const inputLower = input.toLowerCase();

    for (const skill of this.jsonSkills.values()) {
      if (skill.pattern.regex) {
        for (const pattern of skill.pattern.regex) {
          try {
            if (new RegExp(pattern, 'i').test(input)) {
              matches.push({ skill, confidence: 0.9, trigger: 'regex', matched: pattern });
              break;
            }
          } catch { /* bad regex */ }
        }
      }

      if (skill.pattern.keywords) {
        const matched = skill.pattern.keywords.filter(kw => inputLower.includes(kw.toLowerCase()));
        if (matched.length > 0) {
          const confidence = Math.min(0.95, 0.7 + (matched.length / skill.pattern.keywords.length) * 0.25);
          matches.push({ skill, confidence, trigger: 'keyword', matched: matched.join(', ') });
        }
      }

      if (skill.pattern.semantic) {
        const semWords = skill.pattern.semantic.toLowerCase().split(/\s+/);
        const inWords = inputLower.split(/\s+/);
        const overlap = semWords.filter(w => inWords.includes(w)).length;
        if (overlap > 0) {
          const confidence = Math.min(0.85, 0.5 + (overlap / semWords.length) * 0.35);
          if (confidence >= threshold) {
            matches.push({ skill, confidence, trigger: 'semantic', matched: skill.pattern.semantic });
          }
        }
      }
    }

    return matches
      .filter(m => m.confidence >= threshold)
      .sort((a, b) => b.confidence - a.confidence);
  }

  async getAllJsonSkills(): Promise<Skill[]> {
    await this.initialize();
    return Array.from(this.jsonSkills.values());
  }

  async createSkill(config: CreateSkillConfig): Promise<Skill> {
    await this.initialize();
    const skill: Skill = {
      id: randomUUID(),
      name: config.name,
      description: config.description,
      pattern: config.pattern,
      approach: config.approach,
      code: config.code,
      examples: [{ ...config.example, timestamp: new Date().toISOString() }],
      metadata: {
        times_used: 0,
        success_rate: 1.0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        tags: config.tags,
        complexity: config.complexity,
      },
    };
    await this.saveSkill(skill);
    return skill;
  }

  async saveSkill(skill: Skill): Promise<void> {
    await this.initialize();
    const fp = path.join(this.skillsDir, `${skill.id}.json`);
    await fs.writeFile(fp, JSON.stringify(skill, null, 2), 'utf-8');
    this.jsonSkills.set(skill.id, skill);
  }

  async getSkill(id: string): Promise<Skill | undefined> {
    await this.initialize();
    return this.jsonSkills.get(id);
  }

  async recordExecution(skillId: string, success: boolean, example?: Omit<SkillExample, 'timestamp'>): Promise<void> {
    const skill = await this.getSkill(skillId);
    if (!skill) return;

    const total = skill.metadata.times_used + 1;
    const successes = skill.metadata.times_used * skill.metadata.success_rate + (success ? 1 : 0);
    skill.metadata.times_used = total;
    skill.metadata.success_rate = successes / total;
    skill.metadata.last_used = new Date().toISOString();
    skill.metadata.updated_at = new Date().toISOString();

    if (success && example) {
      skill.examples.push({ ...example, timestamp: new Date().toISOString() });
      if (skill.examples.length > 10) skill.examples = skill.examples.slice(-10);
    }
    await this.saveSkill(skill);
  }

  async deleteSkill(skillId: string): Promise<void> {
    await this.initialize();
    const fp = path.join(this.skillsDir, `${skillId}.json`);
    await fs.unlink(fp);
    this.jsonSkills.delete(skillId);
  }

  async searchSkills(query: string): Promise<Skill[]> {
    await this.initialize();
    const q = query.toLowerCase();
    return Array.from(this.jsonSkills.values()).filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.metadata.tags?.some(t => t.toLowerCase().includes(q))
    );
  }

  getSkillsDirectory(): string { return this.skillsDir; }
  clear(): void { this.jsonSkills.clear(); this.mdSkills.clear(); this.initialized = false; }
}

// ─── Singleton ─────────────────────────────────────────────────────────────────

let instance: SkillManager | null = null;
export function getSkillManager(): SkillManager {
  if (!instance) instance = new SkillManager();
  return instance;
}
export function resetSkillManager(): void { instance = null; }
