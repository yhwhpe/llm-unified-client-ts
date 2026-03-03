import type { Message, Request, ChatHistory } from './types';

/**
 * Build a simple request with a single user message.
 */
export function buildSimpleRequest(message: string): Request {
  return {
    messages: [{ role: 'user', content: message }],
  };
}

/**
 * Build a request with chat history and a new user message.
 */
export function buildChatRequest(history: Message[], userMessage: string): Request {
  return {
    messages: [...history, { role: 'user', content: userMessage }],
  };
}

/**
 * Build a request with system prompt and user message.
 */
export function buildRequestWithSystemPrompt(systemPrompt: string, userMessage: string): Request {
  return {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
  };
}

/**
 * Add a system message at the beginning of the request messages.
 */
export function addSystemMessage(request: Request, content: string): void {
  request.messages = [{ role: 'system', content }, ...request.messages];
}

/**
 * Add a user message to the request.
 */
export function addUserMessage(request: Request, content: string): void {
  request.messages.push({ role: 'user', content });
}

/**
 * Add an assistant message to the request.
 */
export function addAssistantMessage(request: Request, content: string): void {
  request.messages.push({ role: 'assistant', content });
}

/**
 * ChatHistory helpers (mutating).
 */
export function addMessage(history: ChatHistory, role: Message['role'], content: string): void {
  history.messages.push({ role, content });
}

export function addHistorySystemMessage(history: ChatHistory, content: string): void {
  addMessage(history, 'system', content);
}

export function addHistoryUserMessage(history: ChatHistory, content: string): void {
  addMessage(history, 'user', content);
}

export function addHistoryAssistantMessage(history: ChatHistory, content: string): void {
  addMessage(history, 'assistant', content);
}

export function getMessages(history: ChatHistory): Message[] {
  return history.messages;
}

export function clearHistory(history: ChatHistory): void {
  history.messages = [];
}

export function getLastMessage(history: ChatHistory): Message | null {
  const messages = history.messages;
  return messages.length === 0 ? null : messages[messages.length - 1];
}

export function truncateHistory(history: ChatHistory, n: number): void {
  if (history.messages.length > n) {
    history.messages = history.messages.slice(-n);
  }
}
