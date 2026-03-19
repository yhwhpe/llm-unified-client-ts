import { newToolAdapter } from './llm/tool-calling/adapter-factory';
import { runToolCallingLoop } from './llm/tool-calling/loop';
import type { ToolCallingMessage, ToolChoiceMode } from './llm/tool-calling/types';
import type { ToolCallingPolicy } from './llm/tool-calling/policy';
import { McpServerRegistry } from './mcp/server-registry';
import type { McpServerDefinition, NamespacedTool } from './mcp/types';
import type { Config, Provider } from './types';

export interface ToolProviderConfig {
  provider: Provider;
  config: Config;
  model?: string;
}

export interface ChatWithToolsOptions {
  userMessage: string;
  systemPrompt?: string;
  history?: ToolCallingMessage[];
  toolChoice?: ToolChoiceMode;
  fireAndForgetTools?: string[];
  onFireAndForgetError?: (toolName: string, error: unknown) => void;
  policy?: Partial<ToolCallingPolicy>;
  providerOrder?: Provider[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface ChatWithToolsResponse {
  content: string;
  provider: Provider;
  messages: ToolCallingMessage[];
}

export interface McpToolClientOptions {
  providers: ToolProviderConfig[];
}

export class McpToolClient {
  private readonly registry = new McpServerRegistry();
  private readonly providers: ToolProviderConfig[];

  constructor(options: McpToolClientOptions) {
    if (!options.providers.length) {
      throw new Error('At least one provider must be configured');
    }
    this.providers = options.providers;
  }

  registerServer(server: McpServerDefinition): void {
    this.registry.registerServer(server);
  }

  async connectServer(serverName: string): Promise<NamespacedTool[]> {
    return this.registry.connectServer(serverName);
  }

  async connectAllServers(): Promise<NamespacedTool[]> {
    return this.registry.connectAll();
  }

  listTools(): NamespacedTool[] {
    return this.registry.listTools();
  }

  async disconnectAll(): Promise<void> {
    await this.registry.disconnectAll();
  }

  async chatWithTools(options: ChatWithToolsOptions): Promise<ChatWithToolsResponse> {
    const tools = this.registry.listTools().map((tool) => ({
      name: tool.namespacedName,
      description: tool.description,
      parameters: tool.inputSchema,
    }));

    const messages: ToolCallingMessage[] = [];
    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    if (options.history?.length) {
      messages.push(...options.history);
    }
    messages.push({ role: 'user', content: options.userMessage });

    const selectedProviders = this.selectProviders(options.providerOrder).map((provider) => ({
      provider: provider.provider,
      model: provider.model,
      adapter: newToolAdapter(provider.config),
    }));

    const result = await runToolCallingLoop({
      providers: selectedProviders,
      tools,
      messages,
      toolChoice: options.toolChoice,
      fireAndForgetTools: options.fireAndForgetTools,
      onFireAndForgetError: options.onFireAndForgetError,
      policy: options.policy,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      signal: options.signal,
      executeTool: async (toolName, args) => {
        return this.registry.callTool(toolName, args);
      },
    });

    return {
      content: result.content,
      provider: result.provider as Provider,
      messages: result.messages,
    };
  }

  private selectProviders(providerOrder?: Provider[]): ToolProviderConfig[] {
    if (!providerOrder || providerOrder.length === 0) return this.providers;
    const lookup = new Map(this.providers.map((p) => [p.provider, p]));
    return providerOrder
      .map((provider) => lookup.get(provider))
      .filter((x): x is ToolProviderConfig => Boolean(x));
  }
}

export function createMcpToolClient(options: McpToolClientOptions): McpToolClient {
  return new McpToolClient(options);
}
