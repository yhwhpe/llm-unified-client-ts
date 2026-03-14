import { describe, expect, it } from 'vitest';
import { McpServerRegistry } from '../src/mcp/server-registry';
import type { McpServerClient } from '../src/mcp/types';

function createMockClient(): McpServerClient {
  return {
    async connect() {},
    async disconnect() {},
    async listTools() {
      return [
        {
          name: 'list_files',
          description: 'List files',
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string' },
            },
          },
        },
      ];
    },
    async callTool(params) {
      return {
        content: { ok: true, called: params.name, args: params.arguments ?? {} },
      };
    },
  };
}

describe('McpServerRegistry', () => {
  it('namespaces tools and routes callTool', async () => {
    const registry = new McpServerRegistry();
    registry.registerServer({
      serverName: 'filesystem',
      client: createMockClient(),
    });

    const tools = await registry.connectServer('filesystem');
    expect(tools).toHaveLength(1);
    expect(tools[0].namespacedName).toBe('filesystem__list_files');

    const result = await registry.callTool('filesystem__list_files', { path: '/tmp' });
    expect(result.content).toEqual({
      ok: true,
      called: 'list_files',
      args: { path: '/tmp' },
    });
  });
});
