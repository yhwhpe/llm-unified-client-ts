import OpenAI from 'openai';
import { ProviderError } from '../../errors';
import type { Config } from '../../types';
import type { LlmToolAdapter, ToolCallingCompletion, ToolCallingRequest } from './types';
import { completeWithOpenAISdk } from './openai-sdk-shared';

export function newDeepSeekToolAdapter(config: Config): LlmToolAdapter {
  if (!config.apiKey) throw new ProviderError(config.provider, 'API key is required');

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl ?? 'https://api.deepseek.com/v1',
    timeout: config.timeoutMs ?? 45_000,
    maxRetries: 0,
  });

  return {
    async complete(request: ToolCallingRequest): Promise<ToolCallingCompletion> {
      return completeWithOpenAISdk(client, config.provider, request, config.defaultModel);
    },
  };
}
