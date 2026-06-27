import type { Provider } from './types.js';
import { BedrockProvider } from './bedrock.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenRouterProvider } from './openrouter.js';
import { OllamaProvider } from './ollama.js';
import { VLLMProvider } from './vllm.js';
import { loadConfig } from '../config.js';

const providers: Record<string, (model?: string) => Provider> = {
  bedrock: (model) => new BedrockProvider(model),
  anthropic: (model) => new AnthropicProvider(model),
  openrouter: (model) => new OpenRouterProvider(model),
  ollama: (model) => new OllamaProvider(model),
  vllm: (model) => {
    const config = loadConfig();
    return new VLLMProvider(
      model || config.model || 'meta-llama/Llama-3-70B-Instruct',
      config.vllm || {}
    );
  },
  'claude-code': (model) => new AnthropicProvider(model), // uses subprocess delegation at agent level
  'codex': (model) => new OpenRouterProvider(model), // uses subprocess delegation at agent level
};

export function getProvider(name: string, model?: string): Provider {
  const factory = providers[name];
  if (!factory) {
    throw new Error(`Unknown provider: ${name}. Available: ${Object.keys(providers).join(', ')}`);
  }
  return factory(model);
}

export { BedrockProvider } from './bedrock.js';
export { AnthropicProvider } from './anthropic.js';
export { OpenRouterProvider } from './openrouter.js';
export { OllamaProvider } from './ollama.js';
export { VLLMProvider } from './vllm.js';
export { delegateToClaudeCode, delegateToCodex } from './subprocess.js';
