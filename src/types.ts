/**
 * Supported LLM providers (aligned with Go llm-unified-client).
 */
export type Provider =
  | 'openai'
  | 'deepseek'
  | 'qwen'
  | 'azure'
  | 'cohere';

/**
 * Role of a chat message.
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'function';

/**
 * A single chat message.
 */
export interface Message {
  role: MessageRole;
  content: string;
  name?: string;
}

/**
 * Conversation history (list of messages).
 */
export interface ChatHistory {
  messages: Message[];
}

/**
 * Request to the LLM.
 */
export interface Request {
  messages: Message[];
  system_prompt?: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  top_k?: number;
  stream?: boolean;
  extra_params?: Record<string, unknown>;
  model?: string;
  deepseek_thinking?: boolean;
}

/**
 * Non-streaming response from the LLM.
 */
export interface Response {
  content: string;
  role?: MessageRole;
  tokens_used?: number;
  response_time_ms: number;
  finish_reason?: string;
  reasoning_content?: string;
}

/**
 * A chunk of streaming response.
 */
export interface StreamChunk {
  content: string;
  finish_reason?: string;
  done: boolean;
}

/**
 * Client configuration.
 */
export interface Config {
  provider: Provider;
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  defaultModel: string;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
  defaultTopP?: number;
  defaultTopK?: number;
  deepseekThinkingEnabled?: boolean;
  extraConfig?: Record<string, unknown>;
}

/**
 * Embedding request.
 */
export interface EmbeddingRequest {
  input: string[];
  model?: string;
}

/**
 * Embedding response.
 */
export interface EmbeddingResponse {
  embeddings: number[][];
  model: string;
  tokens_used?: number;
  response_time_ms: number;
}

/**
 * Client interface: generate, generateWithHistory, createEmbedding, close, getConfig.
 */
export interface Client {
  generate(request: Request): Promise<Response>;
  generateWithHistory(
    history: ChatHistory,
    userMessage: string,
    systemPrompt: string
  ): Promise<Response>;
  createEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse>;
  close(): Promise<void>;
  getConfig(): Config;
}
