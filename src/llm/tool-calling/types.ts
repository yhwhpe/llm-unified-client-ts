import type { Provider } from '../../types';

export interface LlmToolDefinition {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

export interface LlmToolCall {
  id: string;
  name: string;
  argumentsJson?: string;
  arguments?: Record<string, unknown>;
}

export interface ToolCallingMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  name?: string;
  toolCalls?: LlmToolCall[];
}

export interface ToolCallingCompletion {
  content: string;
  toolCalls: LlmToolCall[];
}

export interface ToolCallingRequest {
  messages: ToolCallingMessage[];
  tools: LlmToolDefinition[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface LlmToolAdapter {
  complete(request: ToolCallingRequest): Promise<ToolCallingCompletion>;
}

export interface LlmToolProviderConfig {
  provider: Provider;
  model?: string;
}
