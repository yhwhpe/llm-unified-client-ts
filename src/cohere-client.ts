import type {
  Config,
  Request,
  Response,
  Message,
  EmbeddingRequest,
  EmbeddingResponse,
  ChatHistory,
} from './types';
import type { Client } from './types';
import { fetchWithTimeout, readJson } from './http';
import { buildChatRequest, addSystemMessage } from './request';

const DEFAULT_BASE = 'https://api.cohere.ai/v1';
const CHAT_DEFAULT_MODEL = 'command-r-plus';
const EMBED_DEFAULT_MODEL = 'embed-multilingual-v3.0';

function getModel(request: Request, config: Config): string {
  if (request.model) return request.model;
  const def = config.defaultModel;
  if (def && def !== EMBED_DEFAULT_MODEL) return def;
  return CHAT_DEFAULT_MODEL;
}

/**
 * Cohere chat: message + chat_history (array of { role: USER|CHATBOT, message }).
 * System is prepended to the first user message or sent as first user turn.
 */
function buildChatPayload(request: Request, config: Config): Record<string, unknown> {
  const chatHistory: Array<{ role: string; message: string }> = [];
  let message = '';
  for (let i = 0; i < request.messages.length; i++) {
    const msg = request.messages[i];
    if (msg.role === 'system') continue;
    if (msg.role === 'user') {
      if (i === request.messages.length - 1) {
        message = msg.content;
      } else {
        chatHistory.push({ role: 'USER', message: msg.content });
      }
    } else if (msg.role === 'assistant') {
      chatHistory.push({ role: 'CHATBOT', message: msg.content });
    }
  }
  const payload: Record<string, unknown> = {
    message,
    model: getModel(request, config),
  };
  if (chatHistory.length > 0) payload.chat_history = chatHistory;
  const temp = request.temperature ?? config.defaultTemperature;
  if (temp != null) payload.temperature = temp;
  const maxTokens = request.max_tokens ?? config.defaultMaxTokens;
  if (maxTokens != null) payload.max_tokens = maxTokens;
  const topP = request.top_p ?? config.defaultTopP;
  if (topP != null) payload.p = topP;
  const topK = request.top_k ?? config.defaultTopK;
  if (topK != null) payload.k = topK;
  if (request.extra_params) {
    for (const [k, v] of Object.entries(request.extra_params)) payload[k] = v;
  }
  return payload;
}

export function newCohereClient(config: Config): Client {
  if (!config.apiKey) throw new Error('API key is required');
  const baseUrl = (config.baseUrl ?? DEFAULT_BASE).replace(/\/$/, '');
  const timeoutMs = config.timeoutMs ?? 30_000;

  return {
    getConfig: () => config,

    async generate(request: Request): Promise<Response> {
      const start = Date.now();
      const payload = buildChatPayload(request, config);
      const res = await fetchWithTimeout({
        url: `${baseUrl}/chat`,
        method: 'POST',
        headers: { Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify(payload),
        timeoutMs,
      });
      const data = await readJson<{
        text?: string;
        meta?: { billed_units?: { input_tokens?: number; output_tokens?: number } };
        finish_reason?: string;
      }>(res);
      const inT = data.meta?.billed_units?.input_tokens ?? 0;
      const outT = data.meta?.billed_units?.output_tokens ?? 0;
      return {
        content: data.text ?? '',
        role: 'assistant',
        tokens_used: inT + outT,
        response_time_ms: Date.now() - start,
        finish_reason: data.finish_reason,
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
      const model = request.model ?? (config.defaultModel || EMBED_DEFAULT_MODEL);
      const res = await fetchWithTimeout({
        url: `${baseUrl}/embed`,
        method: 'POST',
        headers: { Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({
          model,
          texts: request.input,
          input_type: 'search_document',
        }),
        timeoutMs,
      });
      const data = await readJson<{
        embeddings?: number[][];
        meta?: { billed_units?: { input_tokens?: number } };
      }>(res);
      const embeddings = data.embeddings ?? [];
      if (embeddings.length === 0) throw new Error('No embeddings in response');
      return {
        embeddings,
        model,
        tokens_used: data.meta?.billed_units?.input_tokens,
        response_time_ms: Date.now() - start,
      };
    },

    async close(): Promise<void> {},
  };
}
