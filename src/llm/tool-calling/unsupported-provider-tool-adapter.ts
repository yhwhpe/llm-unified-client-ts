import { ProviderError } from '../../errors';
import type { Config } from '../../types';
import type { LlmToolAdapter, ToolCallingCompletion, ToolCallingRequest } from './types';

export function newUnsupportedProviderToolAdapter(config: Config): LlmToolAdapter {
  return {
    async complete(_request: ToolCallingRequest): Promise<ToolCallingCompletion> {
      throw new ProviderError(
        config.provider,
        `Provider "${config.provider}" is not supported for tool-calling`
      );
    },
  };
}
