import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface MoltConfig {
  provider: string;
  model: string | null;
  engram_db: string;
  max_tokens: number;
}

const CONFIG_DIR = join(homedir(), '.grain');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

const DEFAULTS: MoltConfig = {
  provider: 'bedrock',
  model: null,
  engram_db: '~/.engram/knowledge',
  max_tokens: 180000,
};

export function loadConfig(): MoltConfig {
  if (!existsSync(CONFIG_PATH)) {
    return { ...DEFAULTS };
  }
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveConfig(config: Partial<MoltConfig>): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  const current = loadConfig();
  const merged = { ...current, ...config };
  writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2));
}

export function getConfigDir(): string {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  return CONFIG_DIR;
}
