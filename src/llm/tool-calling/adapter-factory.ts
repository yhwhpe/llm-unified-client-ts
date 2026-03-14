import type { Config } from '../../types';
import type { LlmToolAdapter } from './types';
import { newOpenAIToolAdapter } from './openai-tool-adapter';
import { newDeepSeekToolAdapter } from './deepseek-tool-adapter';
import { newQwenToolAdapter } from './qwen-tool-adapter';
import { newAzureToolAdapter } from './azure-tool-adapter';
import { newCohereToolAdapter } from './cohere-tool-adapter';
import { newUnsupportedProviderToolAdapter } from './unsupported-provider-tool-adapter';

export function newToolAdapter(config: Config): LlmToolAdapter {
  switch (config.provider) {
    case 'openai':
      return newOpenAIToolAdapter(config);
    case 'deepseek':
      return newDeepSeekToolAdapter(config);
    case 'qwen':
      return newQwenToolAdapter(config);
    case 'azure':
      return newAzureToolAdapter(config);
    case 'cohere':
      return newCohereToolAdapter(config);
    default:
      return newUnsupportedProviderToolAdapter(config);
  }
}
