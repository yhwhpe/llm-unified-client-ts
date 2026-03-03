import type { Config, Request, Response, EmbeddingRequest, EmbeddingResponse, ChatHistory } from './types';
import type { Client } from './types';
import { fetchWithTimeout, readJson } from './http';
import { buildChatRequest, addSystemMessage } from './request';

const AZURE_API_VERSION = '2023-12-01-preview';

/**
 * Azure OpenAI uses the same request/response shape as OpenAI but:
 * - URL must include deployment and api-version query
 * - Auth header is "api-key" instead of "Authorization: Bearer ..."
 */
export function newAzureClient(config: Config): Client {
  if (!config.apiKey) throw new Error('API key is required');
  const baseUrl = (config.baseUrl ?? '').replace(/\/$/, '');
  if (!baseUrl.includes('/deployments/')) {
    throw new Error('Azure OpenAI URL must include deployment: /deployments/<deployment-name>');
  }
  const timeoutMs = config.timeoutMs ?? 30_000;
  const defaultModel = config.defaultModel || 'gpt-35-turbo';

  const chatUrl = `${baseUrl}/chat/completions?api-version=${AZURE_API_VERSION}`;
  const embedUrl = `${baseUrl}/embeddings?api-version=${AZURE_API_VERSION}`;

  return {
    getConfig: () => config,

    async generate(request: Request): Promise<Response> {
      const start = Date.now();
      const payload = buildAzurePayload(config, request);
      const res = await fetchWithTimeout({
        url: chatUrl,
        method: 'POST',
        headers: { 'api-key': config.apiKey },
        body: JSON.stringify(payload),
        timeoutMs,
      });
      const data = await readJson<{
        choices?: Array<{
          message?: { role?: string; content?: string; reasoning_content?: string };
          finish_reason?: string;
        }>;
        usage?: { total_tokens?: number };
      }>(res);
      const choice = data.choices?.[0];
      if (!choice?.message) throw new Error('No choices in LLM response');
      return {
        content: choice.message.content ?? '',
        role: (choice.message.role as Response['role']) ?? 'assistant',
        tokens_used: data.usage?.total_tokens,
        response_time_ms: Date.now() - start,
        finish_reason: choice.finish_reason,
        reasoning_content: choice.message.reasoning_content,
      };
    },

    async generateWithHistory(
      history: ChatHistory,
      userMessage: string,
      systemPrompt: string
    ): Promise<Response> {
      let req = buildChatRequest(history.messages, userMessage);
      if (systemPrompt) addSystemMessage(req, systemPrompt);
      return this.generate(req);
    },

    async createEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse> {
      const start = Date.now();
      const model = request.model ?? defaultModel;
      const res = await fetchWithTimeout({
        url: embedUrl,
        method: 'POST',
        headers: { 'api-key': config.apiKey },
        body: JSON.stringify({ model, input: request.input }),
        timeoutMs,
      });
      const data = await readJson<{
        data?: Array<{ embedding: number[]; index: number }>;
        model?: string;
        usage?: { total_tokens?: number };
      }>(res);
      const raw = data.data ?? [];
      if (raw.length === 0) throw new Error('No embeddings in response');
      const embeddings = raw.sort((a, b) => a.index - b.index).map((x) => x.embedding);
      return {
        embeddings,
        model: data.model ?? model,
        tokens_used: data.usage?.total_tokens,
        response_time_ms: Date.now() - start,
      };
    },

    async close(): Promise<void> {},
  };
}

function buildAzurePayload(config: Config, request: Request): Record<string, unknown> {
  const model = request.model ?? (config.defaultModel || 'gpt-35-turbo');
  const messages = request.messages.map((m) => ({
    role: m.role,
    content: m.content,
    ...(m.name && { name: m.name }),
  }));
  const payload: Record<string, unknown> = {
    model,
    messages,
    stream: request.stream ?? false,
  };
  const temp = request.temperature ?? config.defaultTemperature;
  if (temp != null) payload.temperature = temp;
  const maxTokens = request.max_tokens ?? config.defaultMaxTokens;
  if (maxTokens != null) payload.max_tokens = maxTokens;
  const topP = request.top_p ?? config.defaultTopP;
  if (topP != null) payload.top_p = topP;
  if (request.extra_params) {
    for (const [k, v] of Object.entries(request.extra_params)) payload[k] = v;
  }
  return payload;
}
