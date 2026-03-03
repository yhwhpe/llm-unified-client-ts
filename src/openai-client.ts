import type {
  Config,
  Request,
  Response,
  Message,
  EmbeddingRequest,
  EmbeddingResponse,
  ChatHistory,
  Provider,
} from './types';
import type { Client } from './types';
import { fetchWithTimeout, readJson } from './http';
import { buildChatRequest, addSystemMessage } from './request';

const DEFAULT_BASE: Record<Provider, string> = {
  openai: 'https://api.openai.com/v1',
  deepseek: 'https://api.deepseek.com',
  qwen: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
  azure: '',
  cohere: '',
};

const DEFAULT_MODEL: Record<Provider, string> = {
  openai: 'gpt-3.5-turbo',
  deepseek: 'deepseek-chat',
  qwen: 'qwen-turbo',
  azure: '',
  cohere: '',
};

function getBaseUrl(provider: Provider, baseUrl?: string): string {
  if (baseUrl) return baseUrl;
  return DEFAULT_BASE[provider] ?? 'https://api.openai.com/v1';
}

function getDefaultModel(provider: Provider, defaultModel: string): string {
  if (defaultModel) return defaultModel;
  return DEFAULT_MODEL[provider] ?? 'gpt-3.5-turbo';
}

function toOpenAIMessages(messages: Message[]): Array<{ role: string; content: string; name?: string }> {
  return messages.map((m) => {
    const out: { role: string; content: string; name?: string } = {
      role: m.role,
      content: m.content,
    };
    if (m.name) out.name = m.name;
    return out;
  });
}

function buildPayload(config: Config, request: Request): Record<string, unknown> {
  const model = request.model ?? getDefaultModel(config.provider, config.defaultModel);
  const payload: Record<string, unknown> = {
    model,
    messages: toOpenAIMessages(request.messages),
    stream: request.stream ?? false,
  };
  const temp = request.temperature ?? config.defaultTemperature;
  if (temp != null) payload.temperature = temp;
  const maxTokens = request.max_tokens ?? config.defaultMaxTokens;
  if (maxTokens != null) payload.max_tokens = maxTokens;
  const topP = request.top_p ?? config.defaultTopP;
  if (topP != null) payload.top_p = topP;
  const topK = request.top_k ?? config.defaultTopK;
  if (topK != null) payload.top_k = topK;
  if (config.provider === 'deepseek') {
    const thinking = request.deepseek_thinking ?? config.deepseekThinkingEnabled ?? false;
    if (thinking) payload.thinking = { type: 'enabled' };
  }
  if (request.extra_params) {
    for (const [k, v] of Object.entries(request.extra_params)) payload[k] = v;
  }
  return payload;
}

export function newOpenAICompatibleClient(config: Config): Client {
  if (!config.apiKey) throw new Error('API key is required');
  const baseUrl = getBaseUrl(config.provider, config.baseUrl).replace(/\/$/, '');
  const timeoutMs = config.timeoutMs ?? 30_000;

  return {
    getConfig: () => config,

    async generate(request: Request): Promise<Response> {
      const start = Date.now();
      const payload = buildPayload(config, request);
      const headers: Record<string, string> = { Authorization: `Bearer ${config.apiKey}` };
      if (config.provider === 'qwen') headers['X-DashScope-SSE'] = 'disable';
      const res = await fetchWithTimeout({
        url: `${baseUrl}/chat/completions`,
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        timeoutMs,
      });
      const data = await readJson<{
        choices?: Array<{
          message?: { role?: string; content?: string; reasoning_content?: string };
          finish_reason?: string;
        }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      }>(res);
      const choice = data.choices?.[0];
      if (!choice?.message) throw new Error('No choices in LLM response');
      const responseTimeMs = Date.now() - start;
      return {
        content: choice.message.content ?? '',
        role: (choice.message.role as Response['role']) ?? 'assistant',
        tokens_used: data.usage?.total_tokens,
        response_time_ms: responseTimeMs,
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
      const model = request.model ?? (config.defaultModel || 'text-embedding-3-small');
      const res = await fetchWithTimeout({
        url: `${baseUrl}/embeddings`,
        method: 'POST',
        headers: { Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({ model, input: request.input }),
        timeoutMs,
      });
      const data = await readJson<{
        data?: Array<{ embedding: number[]; index: number }>;
        model?: string;
        usage?: { prompt_tokens?: number; total_tokens?: number };
      }>(res);
      const raw = data.data ?? [];
      if (raw.length === 0) throw new Error('No embeddings in response');
      const embeddings = raw
        .sort((a, b) => a.index - b.index)
        .map((x) => x.embedding);
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
