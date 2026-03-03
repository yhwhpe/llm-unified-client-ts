/**
 * @pe/llm-unified-client — Unified TypeScript client for LLM providers.
 * API aligned with Go llm-unified-client (OpenAI, DeepSeek, Qwen, Azure, Cohere).
 */

export type {
  Provider,
  MessageRole,
  Message,
  ChatHistory,
  Request,
  Response,
  StreamChunk,
  Config,
  EmbeddingRequest,
  EmbeddingResponse,
  Client,
} from './types';

export { newClient } from './client';
export { newOpenAICompatibleClient } from './openai-client';
export { newAzureClient } from './azure-client';
export { newQwenClient } from './qwen-client';
export { newCohereClient } from './cohere-client';

export {
  buildSimpleRequest,
  buildChatRequest,
  buildRequestWithSystemPrompt,
  addSystemMessage,
  addUserMessage,
  addAssistantMessage,
  addMessage,
  addHistorySystemMessage,
  addHistoryUserMessage,
  addHistoryAssistantMessage,
  getMessages,
  clearHistory,
  getLastMessage,
  truncateHistory,
} from './request';

export {
  generateSimple,
  generateWithSystemPrompt,
  generateWithHistory,
} from './convenience';
