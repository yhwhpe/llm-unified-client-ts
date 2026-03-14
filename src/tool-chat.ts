import type { ChatWithToolsOptions, ChatWithToolsResponse, McpToolClient } from './mcp-tool-client';

export async function chatWithTools(
  client: McpToolClient,
  options: ChatWithToolsOptions
): Promise<ChatWithToolsResponse> {
  return client.chatWithTools(options);
}
