import type { Client, ChatHistory } from './types';
import { buildSimpleRequest, buildRequestWithSystemPrompt, buildChatRequest, addSystemMessage } from './request';

/**
 * Generate a response for a single user prompt (no history).
 */
export async function generateSimple(client: Client, prompt: string) {
  const request = buildSimpleRequest(prompt);
  return client.generate(request);
}

/**
 * Generate with system prompt and user message.
 */
export async function generateWithSystemPrompt(
  client: Client,
  systemPrompt: string,
  userMessage: string
) {
  const request = buildRequestWithSystemPrompt(systemPrompt, userMessage);
  return client.generate(request);
}

/**
 * Generate using chat history and optional system prompt.
 */
export async function generateWithHistory(
  client: Client,
  history: ChatHistory,
  userMessage: string,
  systemPrompt: string = ''
) {
  let request = buildChatRequest(history.messages, userMessage);
  if (systemPrompt) addSystemMessage(request, systemPrompt);
  return client.generate(request);
}
