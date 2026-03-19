# @pe/llm-unified-client

TypeScript-библиотека с единым API для LLM-провайдеров (аналог Go [llm-unified-client](https://github.com/yhwhpe/llm-unified-client)).

Теперь пакет также включает MCP SDK слой: multi-server реестр инструментов, tool-calling loop и fallback между LLM провайдерами.

## Поддерживаемые провайдеры

- **OpenAI** — OpenAI API
- **DeepSeek** — DeepSeek API (включая thinking mode)
- **Qwen** — Alibaba DashScope (compatible-mode)
- **Azure** — Azure OpenAI
- **Cohere** — Chat + Embeddings (в т.ч. embed-multilingual-v3.0)

### Tool-calling support (MCP SDK mode)

- **OpenAI / DeepSeek / Qwen / Azure** — native function/tool calling через OpenAI-compatible chat completions.
- **Cohere** — fallback text adapter (без нативного tool-calling в текущей версии SDK).

## Установка

```bash
pnpm add @pe/llm-unified-client
# или из монорепо
pnpm add file:../llm-unified-client-ts
```

## Быстрый старт

```ts
import {
  newClient,
  generateSimple,
  type Config,
} from '@pe/llm-unified-client';

const config: Config = {
  provider: 'deepseek',
  apiKey: process.env.DEEPSEEK_API_KEY!,
  baseUrl: 'https://api.deepseek.com',
  defaultModel: 'deepseek-chat',
  timeoutMs: 30_000,
};

const client = newClient(config);

const response = await generateSimple(client, 'Привет, как дела?');
console.log(response.content);
console.log('Tokens:', response.tokens_used, 'Time:', response.response_time_ms, 'ms');
```

## Конфигурация по провайдерам

### OpenAI

```ts
const config: Config = {
  provider: 'openai',
  apiKey: 'sk-...',
  baseUrl: 'https://api.openai.com/v1',
  defaultModel: 'gpt-4',
  timeoutMs: 30_000,
};
```

### DeepSeek (thinking mode)

```ts
const config: Config = {
  provider: 'deepseek',
  apiKey: '...',
  baseUrl: 'https://api.deepseek.com',
  defaultModel: 'deepseek-chat',
  deepseekThinkingEnabled: true, // thinker / chain-of-thought
};
```

### Qwen (DashScope)

```ts
const config: Config = {
  provider: 'qwen',
  apiKey: '...',
  baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
  defaultModel: 'qwen-turbo',
  timeoutMs: 30_000,
};
```

### Azure OpenAI

```ts
const config: Config = {
  provider: 'azure',
  apiKey: '...',
  baseUrl: 'https://<resource>.openai.azure.com/openai/deployments/<deployment>',
  defaultModel: 'gpt-35-turbo',
  timeoutMs: 30_000,
};
```

### Cohere

```ts
const config: Config = {
  provider: 'cohere',
  apiKey: '...',
  baseUrl: 'https://api.cohere.ai/v1',
  defaultModel: 'embed-multilingual-v3.0', // для embeddings; для chat — command-r-plus
  timeoutMs: 30_000,
};
```

## Примеры

### MCP SDK: multi-server + tool-calling loop

```ts
import {
  createMcpToolClient,
  createMcpSdkServerClient,
  type ToolProviderConfig,
} from '@pe/llm-unified-client';

const providers: ToolProviderConfig[] = [
  {
    provider: 'deepseek',
    config: {
      provider: 'deepseek',
      apiKey: process.env.DEEPSEEK_API_KEY!,
      baseUrl: 'https://api.deepseek.com/v1',
      defaultModel: 'deepseek-chat',
    },
  },
  {
    provider: 'openai',
    config: {
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY!,
      defaultModel: 'gpt-4o-mini',
    },
  },
];

const mcpClient = createMcpToolClient({ providers });

// Здесь может быть любой MCP SDK client с методами connect/listTools/callTool/disconnect
const filesystemSdkClient = getYourMcpSdkClient();
mcpClient.registerServer({
  serverName: 'filesystem',
  client: createMcpSdkServerClient(filesystemSdkClient),
});

await mcpClient.connectAllServers();

const answer = await mcpClient.chatWithTools({
  userMessage: 'Найди все Python файлы в проекте',
  toolChoice: 'required', // потребовать хотя бы один tool-call
  providerOrder: ['deepseek', 'openai'], // fallback порядок
  policy: {
    maxToolIterations: 8,
    perToolTimeoutMs: 20_000,
    maxRetries: 2,
  },
});

console.log(answer.content);
await mcpClient.disconnectAll();
```

### MCP: required + fire-and-forget

```ts
const answer = await mcpClient.chatWithTools({
  userMessage: 'Продолжим диалог',
  toolChoice: { type: 'function', name: 'mesa__runObjectivization' },
  fireAndForgetTools: ['mesa__runObjectivization'],
  onFireAndForgetError: (toolName, error) => {
    console.warn(`[MCP] fire-and-forget failed for ${toolName}`, error);
  },
});
```

- `toolChoice: 'required'` — модель должна вызвать хотя бы один tool (добавлен guard retry на уровне loop).
- `toolChoice: { type: 'function', name }` — модель должна вызвать конкретный tool.
- `fireAndForgetTools` — указанные tools запускаются в фоне; в loop подставляется synthetic tool-result:
  `{"status":"accepted","mode":"fire-and-forget"}`.
- Ошибки фонового исполнения не роняют финальный ответ и приходят в `onFireAndForgetError`.

### Чат с историей

```ts
import {
  newClient,
  generateWithHistory,
  addHistoryUserMessage,
  addHistoryAssistantMessage,
} from '@pe/llm-unified-client';

const client = newClient(config);
const history = { messages: [] };

addHistoryUserMessage(history, 'Привет!');
const r1 = await generateWithHistory(client, history, 'Привет!', '');
addHistoryAssistantMessage(history, r1.content);

const r2 = await generateWithHistory(client, history, 'Расскажи про TypeScript', '');
console.log(r2.content);
```

### System prompt

```ts
import { newClient, generateWithSystemPrompt } from '@pe/llm-unified-client';

const client = newClient(config);
const response = await generateWithSystemPrompt(
  client,
  'Ты помощник-программист. Отвечай кратко.',
  'Как объявить тип в TypeScript?'
);
```

### Embeddings (OpenAI / Cohere)

```ts
import { newClient } from '@pe/llm-unified-client';

const client = newClient({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY!,
  defaultModel: 'text-embedding-3-small',
});

const result = await client.createEmbedding({
  input: ['первый текст', 'второй текст'],
});
console.log(result.embeddings.length, result.embeddings[0].length);
```

### Ручная сборка запроса

```ts
import {
  newClient,
  buildRequestWithSystemPrompt,
  addUserMessage,
} from '@pe/llm-unified-client';

const client = newClient(config);
let req = buildRequestWithSystemPrompt('Ты эксперт.', 'Напиши hello world на Go');
req.max_tokens = 200;
req.temperature = 0.3;
const response = await client.generate(req);
```

## API (совместимость с Go)

- **Типы:** `Provider`, `Message`, `MessageRole`, `ChatHistory`, `Request`, `Response`, `Config`, `EmbeddingRequest`, `EmbeddingResponse`, `Client`
- **Фабрики:** `newClient(config)`, `newOpenAICompatibleClient`, `newAzureClient`, `newQwenClient`, `newCohereClient`
- **Билдеры запросов:** `buildSimpleRequest`, `buildChatRequest`, `buildRequestWithSystemPrompt`, `addSystemMessage`, `addUserMessage`, `addAssistantMessage`
- **История:** `addMessage`, `addHistorySystemMessage`, `addHistoryUserMessage`, `addHistoryAssistantMessage`, `getMessages`, `clearHistory`, `getLastMessage`, `truncateHistory`
- **Удобные вызовы:** `generateSimple(client, prompt)`, `generateWithSystemPrompt(client, system, user)`, `generateWithHistory(client, history, userMessage, systemPrompt)`
- **Клиент:** `client.generate(request)`, `client.generateWithHistory(history, userMessage, systemPrompt)`, `client.createEmbedding(request)`, `client.close()`, `client.getConfig()`
- **MCP реестр:** `McpServerRegistry`, `createMcpSdkServerClient`, `createCallbackMcpServerClient`
- **Tool-calling:** `McpToolClient`, `createMcpToolClient`, `chatWithTools`, `runToolCallingLoop`
- **Policy:** `DEFAULT_TOOL_CALLING_POLICY`, `mergeToolCallingPolicy`
- **Ошибки:** `ProviderError`, `McpTransportError`, `ToolExecutionError`, `PolicyExceededError`

Отличие от Go: время ответа в ответе в миллисекундах (`response_time_ms`), в Go — `time.Duration`. Контекст отмены в TS можно реализовать через `AbortController` при необходимости (пока не в публичном API).

## Сборка

```bash
pnpm install
pnpm build
```

## Лицензия

MIT
