import type { Config, Client } from './types';
import { newOpenAICompatibleClient } from './openai-client';
import { newAzureClient } from './azure-client';
import { newQwenClient } from './qwen-client';
import { newCohereClient } from './cohere-client';

/**
 * Create an LLM client for the given provider.
 * OpenAI, DeepSeek, Qwen use OpenAI-compatible API; Azure and Cohere have dedicated clients.
 */
export function newClient(config: Config): Client {
  switch (config.provider) {
    case 'openai':
    case 'deepseek':
    case 'qwen':
      return newOpenAICompatibleClient(config);
    case 'azure':
      return newAzureClient(config);
    case 'cohere':
      return newCohereClient(config);
    default:
      throw new Error(`Unsupported LLM provider: ${(config as Config).provider}`);
  }
}
