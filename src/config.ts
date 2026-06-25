import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface GrainConfig {
  provider: string;
  model: string | null;
  engram_db: string;
  max_tokens: number;
}

const CONFIG_DIR = join(homedir(), '.grain');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

const DEFAULTS: GrainConfig = {
  provider: 'bedrock',
  model: null,
  engram_db: '~/.engram/knowledge',
  max_tokens: 180000,
};

const VALID_PROVIDERS = ['bedrock', 'anthropic', 'openrouter', 'ollama'] as const;

interface ValidationResult {
  valid: boolean;
  error?: string;
}

function checkEnvVar(varName: string): boolean {
  return !!process.env[varName];
}

export function validateConfig(config: GrainConfig): ValidationResult {
  // Validate provider
  if (!VALID_PROVIDERS.includes(config.provider as any)) {
    return {
      valid: false,
      error: `Invalid provider: ${config.provider}\n\nValid providers: ${VALID_PROVIDERS.join(', ')}\n\nRun: grain init`
    };
  }

  // Check required env vars for selected provider
  let missingEnvVar: string | null = null;

  switch (config.provider) {
    case 'bedrock':
      if (!checkEnvVar('AWS_REGION')) {
        missingEnvVar = 'AWS_REGION';
      }
      break;
    case 'anthropic':
      if (!checkEnvVar('ANTHROPIC_API_KEY')) {
        missingEnvVar = 'ANTHROPIC_API_KEY';
      }
      break;
    case 'openrouter':
      if (!checkEnvVar('OPENROUTER_API_KEY')) {
        missingEnvVar = 'OPENROUTER_API_KEY';
      }
      break;
    case 'ollama':
      // Ollama doesn't require env vars (local)
      break;
  }

  if (missingEnvVar) {
    return {
      valid: false,
      error: `Missing required environment variable: ${missingEnvVar}\n\nFor ${config.provider}, you need to set:\n  export ${missingEnvVar}=<your-value>\n\nRun: grain init`
    };
  }

  return { valid: true };
}

export function loadConfig(): GrainConfig {
  if (!existsSync(CONFIG_PATH)) {
    return { ...DEFAULTS };
  }
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    const config = { ...DEFAULTS, ...parsed };
    
    // Validate config
    const validation = validateConfig(config);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    
    return config;
  } catch (err: any) {
    if (err.message.includes('Invalid provider') || err.message.includes('Missing required')) {
      throw err; // Re-throw validation errors
    }
    return { ...DEFAULTS };
  }
}

export function saveConfig(config: GrainConfig | Partial<GrainConfig>): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  // If full config, save directly. If partial, merge with existing
  if ('provider' in config && 'max_tokens' in config) {
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  } else {
    try {
      const current = existsSync(CONFIG_PATH) ? JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) : DEFAULTS;
      const merged = { ...current, ...config };
      writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2));
    } catch {
      writeFileSync(CONFIG_PATH, JSON.stringify({ ...DEFAULTS, ...config }, null, 2));
    }
  }
}

export function getConfigDir(): string {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  return CONFIG_DIR;
}
