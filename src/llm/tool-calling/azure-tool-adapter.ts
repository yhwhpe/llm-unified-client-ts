import { AzureOpenAI } from 'openai';
import { ProviderError } from '../../errors';
import type { Config } from '../../types';
import type { LlmToolAdapter, ToolCallingCompletion, ToolCallingRequest } from './types';
import { completeWithOpenAISdk } from './openai-sdk-shared';

const AZURE_API_VERSION = '2023-12-01-preview';

function parseAzureEndpoint(baseUrl: string): { endpoint: string; deployment?: string } {
  const cleaned = baseUrl.replace(/\/$/, '');
  const marker = '/openai/deployments/';
  const markerIdx = cleaned.indexOf(marker);
  if (markerIdx === -1) {
    return { endpoint: cleaned };
  }

  const endpoint = cleaned.slice(0, markerIdx);
  const deploymentPart = cleaned.slice(markerIdx + marker.length);
  const deployment = deploymentPart.split('/')[0];
  return {
    endpoint,
    deployment: deployment || undefined,
  };
}

export function newAzureToolAdapter(config: Config): LlmToolAdapter {
  if (!config.apiKey) throw new ProviderError(config.provider, 'API key is required');
  if (!config.baseUrl) {
    throw new ProviderError(
      config.provider,
      'Azure tool adapter requires baseUrl (endpoint or deployment URL)'
    );
  }

  const parsed = parseAzureEndpoint(config.baseUrl);
  const client = new AzureOpenAI({
    apiKey: config.apiKey,
    endpoint: parsed.endpoint,
    deployment: parsed.deployment,
    apiVersion: AZURE_API_VERSION,
    timeout: config.timeoutMs ?? 45_000,
    maxRetries: 0,
  });

  return {
    async complete(request: ToolCallingRequest): Promise<ToolCallingCompletion> {
      return completeWithOpenAISdk(client, config.provider, request, config.defaultModel);
    },
  };
}
