/**
 * Plugin discovery module — shared by config and status commands
 * 
 * Detects installed agent plugins (claude-code, codex, aider) and their versions.
 */
import { ClaudeCodePlugin } from './claude-code.js';
import { CodexPlugin } from './codex.js';

export interface PluginInfo {
  name: string;
  installed: boolean;
  version?: string;
  enabled: boolean;
}

/**
 * Discover installed plugins and their versions
 * 
 * Checks for:
 * - claude-code (via ClaudeCodePlugin)
 * - codex (via CodexPlugin)
 * - aider (via shell which + --version)
 */
export async function discoverPlugins(pluginsConfig?: Record<string, any>): Promise<PluginInfo[]> {
  pluginsConfig = pluginsConfig ?? {};
  
  const plugins: PluginInfo[] = [];
  
  // Check claude-code
  const claudeCode = new ClaudeCodePlugin();
  try {
    const installed = await claudeCode.isInstalled();
    let version: string | undefined;
    if (installed) {
      try {
        version = await claudeCode.getVersion();
      } catch { /* ignore */ }
    }
    plugins.push({
      name: 'claude-code',
      installed,
      version,
      enabled: pluginsConfig['claude-code']?.enabled ?? true,
    });
  } catch {
    plugins.push({ name: 'claude-code', installed: false, enabled: pluginsConfig['claude-code']?.enabled ?? true });
  }
  
  // Check codex
  const codex = new CodexPlugin();
  try {
    const installed = await codex.isInstalled();
    let version: string | undefined;
    if (installed) {
      try {
        version = await codex.getVersion();
      } catch { /* ignore */ }
    }
    plugins.push({
      name: 'codex',
      installed,
      version,
      enabled: pluginsConfig['codex']?.enabled ?? true,
    });
  } catch {
    plugins.push({ name: 'codex', installed: false, enabled: pluginsConfig['codex']?.enabled ?? true });
  }
  
  // Check aider
  try {
    const { execSync } = await import('child_process');
    execSync('which aider', { stdio: 'ignore' });
    let version: string | undefined;
    try {
      version = execSync('aider --version', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch { /* ignore */ }
    plugins.push({
      name: 'aider',
      installed: true,
      version,
      enabled: pluginsConfig['aider']?.enabled ?? false,
    });
  } catch {
    plugins.push({ name: 'aider', installed: false, enabled: pluginsConfig['aider']?.enabled ?? false });
  }
  
  return plugins;
}
