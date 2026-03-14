export interface ToolCallingPolicy {
  maxToolIterations: number;
  perToolTimeoutMs: number;
  llmTimeoutMs: number;
  maxRetries: number;
  retryBackoffMs: number;
}

export const DEFAULT_TOOL_CALLING_POLICY: ToolCallingPolicy = {
  maxToolIterations: 8,
  perToolTimeoutMs: 20_000,
  llmTimeoutMs: 45_000,
  maxRetries: 2,
  retryBackoffMs: 300,
};

export function mergeToolCallingPolicy(
  partial?: Partial<ToolCallingPolicy>
): ToolCallingPolicy {
  if (!partial) return DEFAULT_TOOL_CALLING_POLICY;
  return {
    ...DEFAULT_TOOL_CALLING_POLICY,
    ...partial,
  };
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    return result;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  retryBackoffMs: number
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === maxRetries) break;
      await sleep(retryBackoffMs * (attempt + 1));
    }
  }
  throw lastErr;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
