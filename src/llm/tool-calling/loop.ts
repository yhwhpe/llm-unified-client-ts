import { PolicyExceededError, ProviderError, ToolExecutionError } from '../../errors';
import { mergeToolCallingPolicy, retry, withTimeout } from './policy';
import type {
  LlmToolAdapter,
  LlmToolDefinition,
  ToolCallingCompletion,
  ToolCallingMessage,
  ToolChoiceMode,
} from './types';
import type { ToolCallingPolicy } from './policy';

export interface ProviderAdapterCandidate {
  provider: string;
  adapter: LlmToolAdapter;
  model?: string;
}

export interface RunToolLoopOptions {
  providers: ProviderAdapterCandidate[];
  tools: LlmToolDefinition[];
  messages: ToolCallingMessage[];
  executeTool: (toolName: string, args: Record<string, unknown>) => Promise<unknown>;
  toolChoice?: ToolChoiceMode;
  fireAndForgetTools?: string[];
  onFireAndForgetError?: (toolName: string, error: unknown) => void;
  policy?: Partial<ToolCallingPolicy>;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface RunToolLoopResult {
  content: string;
  provider: string;
  messages: ToolCallingMessage[];
}

export async function runToolCallingLoop(options: RunToolLoopOptions): Promise<RunToolLoopResult> {
  const policy = mergeToolCallingPolicy(options.policy);
  if (options.providers.length === 0) {
    throw new ProviderError('unknown', 'No providers configured for tool-calling');
  }

  const messages = [...options.messages];
  const fireAndForgetTools = new Set(options.fireAndForgetTools ?? []);
  const requiredToolCallMode = isRequiredToolCallMode(options.toolChoice);
  let requiredGuardInjected = false;
  let lastProvider = options.providers[0].provider;

  for (let iteration = 0; iteration < policy.maxToolIterations; iteration++) {
    const completion = await requestCompletionWithFallback(
      options,
      messages,
      policy,
      options.toolChoice
    );
    lastProvider = completion.provider;
    messages.push({
      role: 'assistant',
      content: completion.result.content,
      toolCalls: completion.result.toolCalls,
    });

    if (completion.result.toolCalls.length === 0) {
      if (requiredToolCallMode && !requiredGuardInjected && options.tools.length > 0) {
        requiredGuardInjected = true;
        messages.push({
          role: 'system',
          content: buildRequiredToolCallReminder(options.toolChoice),
        });
        continue;
      }

      return {
        content: completion.result.content,
        provider: completion.provider,
        messages,
      };
    }

    for (const toolCall of completion.result.toolCalls) {
      const toolArgs = resolveToolArgs(toolCall.arguments, toolCall.argumentsJson);
      if (fireAndForgetTools.has(toolCall.name)) {
        void runFireAndForgetTool({
          options,
          policy,
          toolName: toolCall.name,
          toolArgs,
        });

        messages.push({
          role: 'tool',
          toolCallId: toolCall.id,
          name: toolCall.name,
          content: safeJson({
            status: 'accepted',
            mode: 'fire-and-forget',
          }),
        });
        continue;
      }

      const toolResult = await retry(
        () =>
          withTimeout(
            options.executeTool(toolCall.name, toolArgs),
            policy.perToolTimeoutMs,
            `Tool "${toolCall.name}"`
          ),
        policy.maxRetries,
        policy.retryBackoffMs
      );

      messages.push({
        role: 'tool',
        toolCallId: toolCall.id,
        name: toolCall.name,
        content: safeJson(toolResult),
      });
    }
  }

  throw new PolicyExceededError(
    `Tool loop exceeded maxToolIterations=${policy.maxToolIterations}`
  );
}

async function requestCompletionWithFallback(
  options: RunToolLoopOptions,
  messages: ToolCallingMessage[],
  policy: ToolCallingPolicy,
  toolChoice?: ToolChoiceMode
): Promise<{ provider: string; result: ToolCallingCompletion }> {
  let lastErr: unknown;

  for (const provider of options.providers) {
    try {
      const result = await retry(
        () =>
          withTimeout(
            provider.adapter.complete({
              messages,
              tools: options.tools,
              model: provider.model,
              toolChoice,
              temperature: options.temperature,
              maxTokens: options.maxTokens,
              signal: options.signal,
            }),
            policy.llmTimeoutMs,
            `Provider "${provider.provider}"`
          ),
        policy.maxRetries,
        policy.retryBackoffMs
      );
      return {
        provider: provider.provider,
        result,
      };
    } catch (err) {
      lastErr = err;
    }
  }

  throw new ProviderError(
    options.providers[0].provider,
    'All configured providers failed during tool loop',
    lastErr
  );
}

function isRequiredToolCallMode(toolChoice: ToolChoiceMode | undefined): boolean {
  if (!toolChoice) return false;
  if (toolChoice === 'required') return true;
  return typeof toolChoice === 'object' && toolChoice.type === 'function';
}

function buildRequiredToolCallReminder(toolChoice: ToolChoiceMode | undefined): string {
  if (toolChoice && typeof toolChoice === 'object' && toolChoice.type === 'function') {
    return `You must call the tool "${toolChoice.name}" before providing your final answer.`;
  }
  return 'You must call at least one tool before providing your final answer.';
}

async function runFireAndForgetTool(args: {
  options: RunToolLoopOptions;
  policy: ToolCallingPolicy;
  toolName: string;
  toolArgs: Record<string, unknown>;
}): Promise<void> {
  const { options, policy, toolName, toolArgs } = args;
  try {
    await retry(
      () =>
        withTimeout(
          options.executeTool(toolName, toolArgs),
          policy.perToolTimeoutMs,
          `Tool "${toolName}" fire-and-forget`
        ),
      policy.maxRetries,
      policy.retryBackoffMs
    );
  } catch (err) {
    options.onFireAndForgetError?.(toolName, err);
  }
}

function resolveToolArgs(
  directArgs?: Record<string, unknown>,
  jsonArgs?: string
): Record<string, unknown> {
  if (directArgs) return directArgs;
  if (!jsonArgs) return {};
  try {
    const parsed = JSON.parse(jsonArgs);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, unknown>;
  } catch {
    throw new ToolExecutionError(
      'unknown',
      `Tool arguments are not valid JSON object: ${jsonArgs.slice(0, 200)}`
    );
  }
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '{"error":"Failed to serialize tool result"}';
  }
}
