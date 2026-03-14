const SEP = '__';

export function toNamespacedToolName(serverName: string, toolName: string): string {
  return `${serverName}${SEP}${toolName}`;
}

export function fromNamespacedToolName(
  namespacedToolName: string
): { serverName: string; toolName: string } {
  const idx = namespacedToolName.indexOf(SEP);
  if (idx === -1) {
    throw new Error(`Invalid namespaced tool name: ${namespacedToolName}`);
  }
  const serverName = namespacedToolName.slice(0, idx);
  const toolName = namespacedToolName.slice(idx + SEP.length);
  if (!serverName || !toolName) {
    throw new Error(`Invalid namespaced tool name: ${namespacedToolName}`);
  }
  return { serverName, toolName };
}
