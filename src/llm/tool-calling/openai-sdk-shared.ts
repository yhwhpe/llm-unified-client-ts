import OpenAI from 'openai';
import { ProviderError } from '../../errors';
import type { LlmToolCall, ToolCallingCompletion, ToolCallingMessage, ToolCallingRequest } from './types';

function toOpenAIMessages(messages: ToolCallingMessage[]): Array<Record<string, unknown>> {
  return messages.map((m) => {
    if (m.role === 'tool') {
      return {
        role: 'tool',
        tool_call_id: m.toolCallId,
        content: m.content,
      };
    }

    if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
      return {
        role: 'assistant',
        content: m.content || '',
        tool_calls: m.toolCalls.map((call) => ({
          id: call.id,
          type: 'function',
          function: {
            name: call.name,
            arguments: call.argumentsJson ?? JSON.stringify(call.arguments ?? {}),
          },
        })),
      };
    }

    return {
      role: m.role,
      content: m.content,
      ...(m.name ? { name: m.name } : {}),
    };
  });
}

function toToolCalls(rawCalls: Array<{ id?: string; function?: { name?: string; arguments?: string } }>): LlmToolCall[] {
  return rawCalls.reduce<LlmToolCall[]>((acc, call, idx) => {
    const name = call.function?.name;
    if (!name) return acc;

    const argsJson = call.function?.arguments ?? '{}';
    let args: Record<string, unknown> | undefined;
    try {
      args = JSON.parse(argsJson) as Record<string, unknown>;
    } catch {
      args = undefined;
    }

    acc.push({
      id: call.id ?? `tool_call_${idx}`,
      name,
      argumentsJson: argsJson,
      arguments: args,
    });
    return acc;
  }, []);
}

function toTextContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') return item;
        if (!item || typeof item !== 'object') return '';
        const text = (item as { text?: unknown }).text;
        return typeof text === 'string' ? text : '';
      })
      .join('');
  }
  return '';
}

export async function completeWithOpenAISdk(
  client: OpenAI,
  provider: string,
  request: ToolCallingRequest,
  defaultModel: string
): Promise<ToolCallingCompletion> {
  try {
    const payload = {
      model: request.model ?? defaultModel,
      messages: toOpenAIMessages(request.messages) as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming['messages'],
      stream: false,
    } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming;
    if (request.tools.length > 0) {
      payload.tools = request.tools.map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters ?? { type: 'object', properties: {} },
        },
      })) as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming['tools'];
      payload.tool_choice = 'auto';
    }
    if (request.temperature != null) payload.temperature = request.temperature;
    if (request.maxTokens != null) payload.max_tokens = request.maxTokens;

    const completion = await (client.chat.completions.create as unknown as (
      body: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
      options?: OpenAI.RequestOptions
    ) => Promise<OpenAI.Chat.Completions.ChatCompletion>)(
      payload as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
      request.signal ? ({ signal: request.signal } as OpenAI.RequestOptions) : undefined
    );

    const message = completion.choices?.[0]?.message;
    if (!message) {
      throw new ProviderError(provider, 'No choices in provider response');
    }

    return {
      content: toTextContent(message.content),
      toolCalls: toToolCalls(
        ((message.tool_calls ?? []) as Array<{ id?: string; function?: { name?: string; arguments?: string } }>).map((call) => ({
          id: call.id,
          function: {
            name: call.function?.name,
            arguments: call.function?.arguments,
          },
        }))
      ),
    };
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    throw new ProviderError(provider, `Tool-calling request failed for provider "${provider}"`, err);
  }
}
