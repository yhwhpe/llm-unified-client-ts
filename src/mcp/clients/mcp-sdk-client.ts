import type { McpCallToolParams, McpCallToolResult, McpServerClient, McpTool } from '../types';

interface GenericMcpSdkClient {
  connect?: (...args: unknown[]) => Promise<unknown>;
  disconnect?: (...args: unknown[]) => Promise<unknown>;
  close?: (...args: unknown[]) => Promise<unknown>;
  listTools?: (...args: unknown[]) => Promise<{ tools?: McpTool[] } | McpTool[]>;
  list_tools?: (...args: unknown[]) => Promise<{ tools?: McpTool[] } | McpTool[]>;
  callTool?: (...args: unknown[]) => Promise<McpCallToolResult>;
  call_tool?: (...args: unknown[]) => Promise<McpCallToolResult>;
}

export function createMcpSdkServerClient(client: GenericMcpSdkClient): McpServerClient {
  return {
    async connect(): Promise<void> {
      if (client.connect) {
        await client.connect();
      }
    },

    async disconnect(): Promise<void> {
      if (client.disconnect) {
        await client.disconnect();
        return;
      }
      if (client.close) {
        await client.close();
      }
    },

    async listTools(): Promise<McpTool[]> {
      const listFn = client.listTools ?? client.list_tools;
      if (!listFn) throw new Error('MCP SDK client does not provide listTools/list_tools');
      const raw = await listFn.call(client);
      if (Array.isArray(raw)) return raw;
      return raw.tools ?? [];
    },

    async callTool(params: McpCallToolParams): Promise<McpCallToolResult> {
      const callFn = client.callTool ?? client.call_tool;
      if (!callFn) throw new Error('MCP SDK client does not provide callTool/call_tool');
      try {
        return await callFn.call(client, {
          name: params.name,
          arguments: params.arguments ?? {},
        });
      } catch {
        return callFn.call(client, params.name, params.arguments ?? {});
      }
    },
  };
}
