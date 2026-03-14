import {
  createMcpSdkServerClient,
  createMcpToolClient,
  type ToolProviderConfig,
} from '../src/index';

async function main() {
  const providers: ToolProviderConfig[] = [
    {
      provider: 'deepseek',
      config: {
        provider: 'deepseek',
        apiKey: process.env.DEEPSEEK_API_KEY ?? '',
        baseUrl: 'https://api.deepseek.com/v1',
        defaultModel: 'deepseek-chat',
      },
    },
    {
      provider: 'openai',
      config: {
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY ?? '',
        defaultModel: 'gpt-4o-mini',
      },
    },
  ];

  const client = createMcpToolClient({ providers });

  // Replace with real MCP SDK client instances.
  const filesystemMcpClient = {
    async connect() {},
    async disconnect() {},
    async listTools() {
      return {
        tools: [
          {
            name: 'list_files',
            description: 'List files in project folder',
            inputSchema: {
              type: 'object',
              properties: { path: { type: 'string' } },
              required: ['path'],
            },
          },
        ],
      };
    },
    async callTool(request: { name: string; arguments: Record<string, unknown> }) {
      return {
        content: {
          tool: request.name,
          args: request.arguments,
          files: ['src/index.ts', 'src/client.ts', 'README.md'],
        },
      };
    },
  };

  client.registerServer({
    serverName: 'filesystem',
    client: createMcpSdkServerClient(filesystemMcpClient),
  });

  await client.connectAllServers();

  const response = await client.chatWithTools({
    userMessage: 'Найди TypeScript файлы в проекте',
    systemPrompt: 'Ты инженер-помощник. Используй tools когда это полезно.',
    providerOrder: ['deepseek', 'openai'],
    policy: {
      maxToolIterations: 6,
      maxRetries: 1,
    },
  });

  console.log(response.content);
  await client.disconnectAll();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
