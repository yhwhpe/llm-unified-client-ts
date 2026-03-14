export class ProviderError extends Error {
  readonly provider: string;
  readonly cause?: unknown;

  constructor(provider: string, message: string, cause?: unknown) {
    super(message);
    this.name = 'ProviderError';
    this.provider = provider;
    this.cause = cause;
  }
}

export class McpTransportError extends Error {
  readonly serverName: string;
  readonly cause?: unknown;

  constructor(serverName: string, message: string, cause?: unknown) {
    super(message);
    this.name = 'McpTransportError';
    this.serverName = serverName;
    this.cause = cause;
  }
}

export class ToolExecutionError extends Error {
  readonly toolName: string;
  readonly cause?: unknown;

  constructor(toolName: string, message: string, cause?: unknown) {
    super(message);
    this.name = 'ToolExecutionError';
    this.toolName = toolName;
    this.cause = cause;
  }
}

export class PolicyExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PolicyExceededError';
  }
}
