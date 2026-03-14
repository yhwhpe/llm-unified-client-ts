import { ProviderError } from '../../errors';
import type { Config } from '../../types';
import type { LlmToolAdapter, ToolCallingCompletion, ToolCallingRequest } from './types';

export function newCohereToolAdapter(config: Config): LlmToolAdapter {
  return {
    async complete(_request: ToolCallingRequest): Promise<ToolCallingCompletion> {
      throw new ProviderError(
        config.provider,
        'Cohere tool-calling is not supported in this SDK yet'
      );
    },
  };
}
