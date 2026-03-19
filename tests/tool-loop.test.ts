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

  it('enforces required tool call with one guard retry', async () => {
    let callCount = 0;
    const adapter: LlmToolAdapter = {
      async complete(req) {
        callCount += 1;
        if (callCount === 1) {
          expect(req.toolChoice).toBe('required');
          return { content: 'no tools yet', toolCalls: [] };
        }

        if (callCount === 2) {
          const hasReminder = req.messages.some(
            (msg) =>
              msg.role === 'system' &&
              msg.content.includes('must call at least one tool')
          );
          expect(hasReminder).toBe(true);
          return {
            content: '',
            toolCalls: [
              {
                id: 'required_call',
                name: 'filesystem__list_files',
                arguments: { path: '/project' },
              },
            ],
          };
        }

        const toolMessage = req.messages.find((m) => m.role === 'tool');
        return {
          content: `resolved: ${toolMessage?.content ?? ''}`,
          toolCalls: [],
        };
      },
    };

    const result = await runToolCallingLoop({
      providers: [{ provider: 'openai', adapter }],
      tools: [{ name: 'filesystem__list_files', parameters: { type: 'object' } }],
      messages: [{ role: 'user', content: 'List files' }],
      toolChoice: 'required',
      policy: {
        maxToolIterations: 5,
        maxRetries: 0,
        llmTimeoutMs: 5000,
        perToolTimeoutMs: 5000,
        retryBackoffMs: 1,
      },
      executeTool: async () => ({ files: ['a.ts'] }),
    });

    expect(callCount).toBe(3);
    expect(result.content).toContain('resolved:');
  });

  it('supports fire-and-forget tools without blocking response', async () => {
    let callCount = 0;
    let fireAndForgetErrors = 0;
    let lastErrorMessage = '';

    const adapter: LlmToolAdapter = {
      async complete(req) {
        callCount += 1;
        if (callCount === 1) {
          return {
            content: '',
            toolCalls: [
              {
                id: 'ff_call',
                name: 'mesa__runObjectivization',
                arguments: { accountId: 'acc-1' },
              },
            ],
          };
        }

        const toolMessage = req.messages.find((m) => m.role === 'tool');
        expect(toolMessage?.content).toContain('"mode":"fire-and-forget"');
        expect(toolMessage?.content).toContain('"status":"accepted"');
        return {
          content: 'final response',
          toolCalls: [],
        };
      },
    };

    const start = Date.now();
    const result = await runToolCallingLoop({
      providers: [{ provider: 'openai', adapter }],
      tools: [{ name: 'mesa__runObjectivization', parameters: { type: 'object' } }],
      messages: [{ role: 'user', content: 'Analyze latest dialog' }],
      fireAndForgetTools: ['mesa__runObjectivization'],
      onFireAndForgetError: (_toolName, error) => {
        fireAndForgetErrors += 1;
        lastErrorMessage = error instanceof Error ? error.message : String(error);
      },
      policy: {
        maxToolIterations: 4,
        maxRetries: 0,
        llmTimeoutMs: 5000,
        perToolTimeoutMs: 5000,
        retryBackoffMs: 1,
      },
      executeTool: async () => {
        await sleep(40);
        throw new Error('background failed');
      },
    });
    const elapsedMs = Date.now() - start;

    expect(result.content).toBe('final response');
    expect(elapsedMs).toBeLessThan(40);

    await sleep(60);
    expect(fireAndForgetErrors).toBe(1);
    expect(lastErrorMessage).toContain('background failed');
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
