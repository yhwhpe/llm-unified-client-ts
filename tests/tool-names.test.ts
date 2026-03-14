import { describe, expect, it } from 'vitest';
import { fromNamespacedToolName, toNamespacedToolName } from '../src/mcp/tool-names';

describe('tool names', () => {
  it('builds and parses namespaced tool names', () => {
    const namespaced = toNamespacedToolName('filesystem', 'read_file');
    expect(namespaced).toBe('filesystem__read_file');
    expect(fromNamespacedToolName(namespaced)).toEqual({
      serverName: 'filesystem',
      toolName: 'read_file',
    });
  });
});
