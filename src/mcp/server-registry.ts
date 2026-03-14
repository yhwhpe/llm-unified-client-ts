import { McpTransportError, ToolExecutionError } from '../errors';
import { fromNamespacedToolName, toNamespacedToolName } from './tool-names';
import type {
  McpCallToolResult,
  McpServerDefinition,
  NamespacedTool,
} from './types';

interface RegisteredServer {
  definition: McpServerDefinition;
  connected: boolean;
  tools: NamespacedTool[];
}

export class McpServerRegistry {
  private readonly servers = new Map<string, RegisteredServer>();

  registerServer(definition: McpServerDefinition): void {
    if (this.servers.has(definition.serverName)) {
      throw new Error(`MCP server "${definition.serverName}" already registered`);
    }
    this.servers.set(definition.serverName, {
      definition,
      connected: false,
      tools: [],
    });
  }

  async connectServer(serverName: string): Promise<NamespacedTool[]> {
    const state = this.getServerState(serverName);
    try {
      await state.definition.client.connect();
      const tools = await state.definition.client.listTools();
      state.connected = true;
      state.tools = tools.map((tool) => ({
        serverName,
        originalName: tool.name,
        namespacedName: toNamespacedToolName(serverName, tool.name),
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));
      return state.tools;
    } catch (err) {
      throw new McpTransportError(serverName, `Failed to connect MCP server "${serverName}"`, err);
    }
  }

  async connectAll(): Promise<NamespacedTool[]> {
    const all: NamespacedTool[] = [];
    for (const serverName of this.servers.keys()) {
      const tools = await this.connectServer(serverName);
      all.push(...tools);
    }
    return all;
  }

  async disconnectServer(serverName: string): Promise<void> {
    const state = this.getServerState(serverName);
    if (!state.connected) return;
    try {
      await state.definition.client.disconnect();
      state.connected = false;
      state.tools = [];
    } catch (err) {
      throw new McpTransportError(
        serverName,
        `Failed to disconnect MCP server "${serverName}"`,
        err
      );
    }
  }

  async disconnectAll(): Promise<void> {
    for (const serverName of this.servers.keys()) {
      await this.disconnectServer(serverName);
    }
  }

  listTools(): NamespacedTool[] {
    const all: NamespacedTool[] = [];
    for (const state of this.servers.values()) {
      if (!state.connected) continue;
      all.push(...state.tools);
    }
    return all;
  }

  async callTool(
    namespacedToolName: string,
    args: Record<string, unknown>
  ): Promise<McpCallToolResult> {
    const { serverName, toolName } = fromNamespacedToolName(namespacedToolName);
    const state = this.getServerState(serverName);
    if (!state.connected) {
      throw new McpTransportError(serverName, `MCP server "${serverName}" is not connected`);
    }
    try {
      return await state.definition.client.callTool({
        name: toolName,
        arguments: args,
      });
    } catch (err) {
      throw new ToolExecutionError(
        namespacedToolName,
        `Failed to execute MCP tool "${namespacedToolName}"`,
        err
      );
    }
  }

  isConnected(serverName: string): boolean {
    const state = this.servers.get(serverName);
    return Boolean(state?.connected);
  }

  private getServerState(serverName: string): RegisteredServer {
    const state = this.servers.get(serverName);
    if (!state) throw new Error(`MCP server "${serverName}" is not registered`);
    return state;
  }
}
