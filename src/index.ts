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

export type { McpTool, McpCallToolResult, McpServerClient, McpServerDefinition } from './mcp/types';
export { McpServerRegistry } from './mcp/server-registry';
export { createCallbackMcpServerClient } from './mcp/clients/callback-client';
export { createMcpSdkServerClient } from './mcp/clients/mcp-sdk-client';

export type {
  LlmToolDefinition,
  LlmToolCall,
  ToolCallingMessage,
  ToolCallingCompletion,
  ToolCallingRequest,
  ToolChoiceMode,
  LlmToolAdapter,
} from './llm/tool-calling/types';
export type { ToolCallingPolicy } from './llm/tool-calling/policy';
export { DEFAULT_TOOL_CALLING_POLICY, mergeToolCallingPolicy } from './llm/tool-calling/policy';
export { newToolAdapter } from './llm/tool-calling/adapter-factory';
export { runToolCallingLoop } from './llm/tool-calling/loop';

export type {
  ToolProviderConfig,
  ChatWithToolsOptions,
  ChatWithToolsResponse,
  McpToolClientOptions,
} from './mcp-tool-client';
export { McpToolClient, createMcpToolClient } from './mcp-tool-client';
export { chatWithTools } from './tool-chat';

export {
  ProviderError,
  McpTransportError,
  ToolExecutionError,
  PolicyExceededError,
} from './errors';
