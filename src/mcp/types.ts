export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface McpCallToolParams {
  name: string;
  arguments?: Record<string, unknown>;
}

export interface McpCallToolResult {
  content: unknown;
  isError?: boolean;
}

export interface McpServerClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  listTools(): Promise<McpTool[]>;
  callTool(params: McpCallToolParams): Promise<McpCallToolResult>;
}

export interface McpServerDefinition {
  serverName: string;
  client: McpServerClient;
}

export interface NamespacedTool {
  serverName: string;
  originalName: string;
  namespacedName: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}
