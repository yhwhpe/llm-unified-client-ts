import { describe, expect, it } from 'vitest';
import { runToolCallingLoop } from '../src/llm/tool-calling/loop';
import type { LlmToolAdapter } from '../src/llm/tool-calling/types';

describe('runToolCallingLoop', () => {
  it('falls back to second provider and executes tool loop', async () => {
    let secondCallCount = 0;
    const failingAdapter: LlmToolAdapter = {
      async complete() {
        throw new Error('provider down');
      },
    };

    const workingAdapter: LlmToolAdapter = {
      async complete(req) {
        secondCallCount += 1;
        if (secondCallCount === 1) {
          return {
            content: '',
            toolCalls: [
              {
                id: 'call_1',
                name: 'filesystem__list_files',
                arguments: { path: '/project' },
              },
            ],
          };
        }
        const toolMessage = req.messages.find((m) => m.role === 'tool');
        return {
          content: `done: ${toolMessage?.content ?? ''}`,
          toolCalls: [],
        };
      },
    };

    const result = await runToolCallingLoop({
      providers: [
        { provider: 'openai', adapter: failingAdapter },
        { provider: 'deepseek', adapter: workingAdapter },
      ],
      tools: [
        {
          name: 'filesystem__list_files',
          parameters: { type: 'object' },
        },
      ],
      messages: [{ role: 'user', content: 'List files' }],
      policy: {
        maxToolIterations: 4,
        maxRetries: 0,
        llmTimeoutMs: 5000,
        perToolTimeoutMs: 5000,
        retryBackoffMs: 1,
      },
      executeTool: async (toolName, args) => ({
        fromTool: toolName,
        args,
        files: ['a.ts', 'b.ts'],
      }),
    });

    expect(result.provider).toBe('deepseek');
    expect(result.content).toContain('done:');
    expect(secondCallCount).toBe(2);
  });
});
