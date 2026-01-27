export type McpServerConfig = {
  name: string
  url: string
  headers?: Record<string, string>
  query?: Record<string, string>
}

type RegistryEntry = {
  name?: unknown
  url?: unknown
  headers?: unknown
  query?: unknown
}

export type McpRegistryInfo = {
  servers: McpServerConfig[]
  error?: string
}

export function getMcpServerRegistryInfo(): McpRegistryInfo {
  const raw = process.env.MCP_SERVER_REGISTRY
  if (!raw) return { servers: [] }

  try {
    const parsed = JSON.parse(raw) as RegistryEntry[]
    if (!Array.isArray(parsed)) {
      return { servers: [], error: 'MCP_SERVER_REGISTRY 必须是 JSON 数组' }
    }

    const servers = parsed
      .map((item) => ({
        name: typeof item.name === 'string' ? item.name : '',
        url: typeof item.url === 'string' ? item.url : '',
        headers:
          item.headers && typeof item.headers === 'object' && !Array.isArray(item.headers)
            ? (item.headers as Record<string, string>)
            : undefined,
        query:
          item.query && typeof item.query === 'object' && !Array.isArray(item.query)
            ? (item.query as Record<string, string>)
            : undefined,
      }))
      .filter((item) => item.name && item.url)
      .map((item) => ({
        name: item.name.trim(),
        url: item.url.trim(),
        headers: item.headers,
      }))
      .filter((item) => item.name && item.url)

    if (servers.length === 0) {
      return { servers: [], error: 'MCP_SERVER_REGISTRY 中未解析到有效的 name/url' }
    }

    return { servers }
  } catch {
    return { servers: [], error: 'MCP_SERVER_REGISTRY 不是合法 JSON' }
  }
}

export function getMcpServerRegistry(): McpServerConfig[] {
  return getMcpServerRegistryInfo().servers
}

export function resolveMcpServers(serverNames?: string[]) {
  const registry = getMcpServerRegistry()
  if (!serverNames || serverNames.length === 0) return registry
  return registry.filter((server) => serverNames.includes(server.name))
}
