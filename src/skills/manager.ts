/**
 * Skills Manager
 * 
 * Manages loading, matching, executing, and tracking skills from ~/.grain/skills/
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import {
  Skill,
  SkillMatch,
  SkillExecutionResult,
  CreateSkillConfig,
  SkillExample,
} from './types';

export class SkillManager {
  private skills: Map<string, Skill> = new Map();
  private skillsDir: string;
  private initialized: boolean = false;

  constructor(skillsDir?: string) {
    this.skillsDir = skillsDir || path.join(os.homedir(), '.grain', 'skills');
  }

  /**
   * Initialize the skills directory and load all skills
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Ensure skills directory exists
    await fs.mkdir(this.skillsDir, { recursive: true });

    // Load all skills
    await this.loadSkills();
    this.initialized = true;
  }

  /**
   * Load all skills from the skills directory
   */
  async loadSkills(): Promise<void> {
    try {
      const files = await fs.readdir(this.skillsDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      for (const file of jsonFiles) {
        try {
          const content = await fs.readFile(
            path.join(this.skillsDir, file),
            'utf-8'
          );
          const skill: Skill = JSON.parse(content);
          this.skills.set(skill.id, skill);
        } catch (error) {
          console.error(`Failed to load skill ${file}:`, error);
        }
      }
    } catch (error) {
      // Directory might not exist yet
      console.debug('Skills directory not found, will be created on first save');
    }
  }

  /**
   * Match user input against available skills
   */
  async matchSkills(input: string, threshold: number = 0.6): Promise<SkillMatch[]> {
    await this.initialize();

    const matches: SkillMatch[] = [];
    const inputLower = input.toLowerCase();

    for (const skill of this.skills.values()) {
      // Check regex patterns
      if (skill.pattern.regex) {
        for (const pattern of skill.pattern.regex) {
          try {
            const regex = new RegExp(pattern, 'i');
            if (regex.test(input)) {
              matches.push({
                skill,
                confidence: 0.9,
                trigger: 'regex',
                matched: pattern,
              });
              break;
            }
          } catch (error) {
            console.error(`Invalid regex pattern: ${pattern}`, error);
          }
        }
      }

      // Check keywords
      if (skill.pattern.keywords) {
        const matchedKeywords = skill.pattern.keywords.filter(kw =>
          inputLower.includes(kw.toLowerCase())
        );
        
        if (matchedKeywords.length > 0) {
          const confidence = Math.min(
            0.95,
            0.7 + (matchedKeywords.length / skill.pattern.keywords.length) * 0.25
          );
          matches.push({
            skill,
            confidence,
            trigger: 'keyword',
            matched: matchedKeywords.join(', '),
          });
        }
      }

      // TODO: Semantic matching using embeddings
      // For now, simple word overlap as a proxy
      if (skill.pattern.semantic) {
        const semanticWords = skill.pattern.semantic.toLowerCase().split(/\s+/);
        const inputWords = inputLower.split(/\s+/);
        const overlap = semanticWords.filter(w => inputWords.includes(w)).length;
        
        if (overlap > 0) {
          const confidence = Math.min(0.85, 0.5 + (overlap / semanticWords.length) * 0.35);
          if (confidence >= threshold) {
            matches.push({
              skill,
              confidence,
              trigger: 'semantic',
              matched: skill.pattern.semantic,
            });
          }
        }
      }
    }

    // Sort by confidence descending
    return matches
      .filter(m => m.confidence >= threshold)
      .sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Get a skill by ID
   */
  async getSkill(id: string): Promise<Skill | undefined> {
    await this.initialize();
    return this.skills.get(id);
  }

  /**
   * Get all skills
   */
  async getAllSkills(): Promise<Skill[]> {
    await this.initialize();
    return Array.from(this.skills.values());
  }

  /**
   * Create a new skill
   */
  async createSkill(config: CreateSkillConfig): Promise<Skill> {
    await this.initialize();

    const skill: Skill = {
      id: randomUUID(),
      name: config.name,
      description: config.description,
      pattern: config.pattern,
      approach: config.approach,
      code: config.code,
      examples: [
        {
          ...config.example,
          timestamp: new Date().toISOString(),
        },
      ],
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

  /**
   * Save a skill to disk
   */
  async saveSkill(skill: Skill): Promise<void> {
    await this.initialize();

    const filePath = path.join(this.skillsDir, `${skill.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(skill, null, 2), 'utf-8');
    this.skills.set(skill.id, skill);
  }

  /**
   * Update skill metadata after execution
   */
  async recordExecution(
    skillId: string,
    success: boolean,
    example?: Omit<SkillExample, 'timestamp'>
  ): Promise<void> {
    const skill = await this.getSkill(skillId);
    if (!skill) {
      throw new Error(`Skill ${skillId} not found`);
    }

    // Update metadata
    const totalExecutions = skill.metadata.times_used + 1;
    const successCount =
      skill.metadata.times_used * skill.metadata.success_rate + (success ? 1 : 0);
    
    skill.metadata.times_used = totalExecutions;
    skill.metadata.success_rate = successCount / totalExecutions;
    skill.metadata.last_used = new Date().toISOString();
    skill.metadata.updated_at = new Date().toISOString();

    // Add example if provided and successful
    if (success && example) {
      skill.examples.push({
        ...example,
        timestamp: new Date().toISOString(),
      });

      // Keep only the last 10 examples
      if (skill.examples.length > 10) {
        skill.examples = skill.examples.slice(-10);
      }
    }

    await this.saveSkill(skill);
  }

  /**
   * Delete a skill
   */
  async deleteSkill(skillId: string): Promise<void> {
    await this.initialize();

    const filePath = path.join(this.skillsDir, `${skillId}.json`);
    await fs.unlink(filePath);
    this.skills.delete(skillId);
  }

  /**
   * Search skills by tags or name
   */
  async searchSkills(query: string): Promise<Skill[]> {
    await this.initialize();

    const queryLower = query.toLowerCase();
    return Array.from(this.skills.values()).filter(skill => {
      const nameMatch = skill.name.toLowerCase().includes(queryLower);
      const descMatch = skill.description.toLowerCase().includes(queryLower);
      const tagMatch = skill.metadata.tags?.some(tag =>
        tag.toLowerCase().includes(queryLower)
      );
      return nameMatch || descMatch || tagMatch;
    });
  }

  /**
   * Get top performing skills
   */
  async getTopSkills(limit: number = 10): Promise<Skill[]> {
    await this.initialize();

    return Array.from(this.skills.values())
      .sort((a, b) => {
        // Sort by success rate, then by times used
        const scoreDiff = b.metadata.success_rate - a.metadata.success_rate;
        if (Math.abs(scoreDiff) > 0.1) return scoreDiff;
        return b.metadata.times_used - a.metadata.times_used;
      })
      .slice(0, limit);
  }

  /**
   * Export skills for backup or sharing
   */
  async exportSkills(outputPath: string): Promise<void> {
    await this.initialize();

    const skills = Array.from(this.skills.values());
    await fs.writeFile(outputPath, JSON.stringify(skills, null, 2), 'utf-8');
  }

  /**
   * Import skills from backup or shared file
   */
  async importSkills(inputPath: string, merge: boolean = true): Promise<number> {
    await this.initialize();

    const content = await fs.readFile(inputPath, 'utf-8');
    const skills: Skill[] = JSON.parse(content);

    let imported = 0;
    for (const skill of skills) {
      if (!merge || !this.skills.has(skill.id)) {
        await this.saveSkill(skill);
        imported++;
      }
    }

    return imported;
  }

  /**
   * Get skills directory path
   */
  getSkillsDirectory(): string {
    return this.skillsDir;
  }

  /**
   * Clear all loaded skills (useful for testing)
   */
  clear(): void {
    this.skills.clear();
    this.initialized = false;
  }
}

// Singleton instance
let instance: SkillManager | null = null;

/**
 * Get the default SkillManager instance
 */
export function getSkillManager(): SkillManager {
  if (!instance) {
    instance = new SkillManager();
  }
  return instance;
}

/**
 * Reset the singleton (useful for testing)
 */
export function resetSkillManager(): void {
  instance = null;
}
