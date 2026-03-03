/**
 * Qwen uses OpenAI-compatible API (dashscope compatible-mode).
 * Re-export factory that uses OpenAI-compatible client with Qwen defaults.
 */
import type { Config } from './types';
import { newOpenAICompatibleClient } from './openai-client';

export function newQwenClient(config: Config) {
  const baseUrl = config.baseUrl ?? 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
  const defaultModel = config.defaultModel || 'qwen-turbo';
  return newOpenAICompatibleClient({
    ...config,
    provider: 'qwen',
    baseUrl,
    defaultModel,
  });
}
