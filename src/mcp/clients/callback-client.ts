import type { McpCallToolParams, McpCallToolResult, McpServerClient, McpTool } from '../types';

export interface CallbackMcpServerClientOptions {
  connect?: () => Promise<void>;
  disconnect?: () => Promise<void>;
  listTools: () => Promise<McpTool[]>;
  callTool: (params: McpCallToolParams) => Promise<McpCallToolResult>;
}

export function createCallbackMcpServerClient(
  options: CallbackMcpServerClientOptions
): McpServerClient {
  return {
    connect: options.connect ?? (async () => {}),
    disconnect: options.disconnect ?? (async () => {}),
    listTools: options.listTools,
    callTool: options.callTool,
  };
}
