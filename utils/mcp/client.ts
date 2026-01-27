import { type McpServerConfig } from '@/utils/mcp/registry'

const DEFAULT_TOOL_TIMEOUT_MS = 8000
const MCP_PROTOCOL_VERSION = '2025-11-25'

export type McpTool = {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

type JsonRpcRequest = {
  jsonrpc: '2.0'
  id?: number
  method: string
  params?: Record<string, unknown>
}

type JsonRpcResponse = {
  jsonrpc: '2.0'
  id?: number
  result?: Record<string, unknown>
  error?: { code: number; message: string; data?: unknown }
}

function isStreamableEndpoint(url: string) {
  return /\/mcp\/?$/i.test(url)
}

function appendQuery(url: string, query?: Record<string, string>) {
  if (!query || Object.keys(query).length === 0) return url
  const target = new URL(url)
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      target.searchParams.set(key, String(value))
    }
  })
  return target.toString()
}

function resolveEndpoint(server: McpServerConfig, path?: string) {
  const base = path ? `${server.url.replace(/\/$/, '')}${path}` : server.url
  return appendQuery(base, server.query)
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

async function readJsonRpcFromSse(response: Response, expectedId?: number) {
  if (!response.body) {
    throw new Error('SSE stream not available')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''

    for (const raw of events) {
      const lines = raw.split('\n')
      const dataLines = lines
        .map((line) => line.trim())
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.replace(/^data:\s?/, ''))

      if (dataLines.length === 0) continue

      const dataText = dataLines.join('\n').trim()
      if (!dataText || dataText === '[DONE]') continue

      try {
        const payload = JSON.parse(dataText) as JsonRpcResponse
        if (expectedId === undefined || payload.id === expectedId) {
          return payload
        }
      } catch {
        continue
      }
    }
  }

  throw new Error('SSE response missing JSON-RPC payload')
}

async function mcpRequest(
  server: McpServerConfig,
  message: JsonRpcRequest,
  timeoutMs: number,
  sessionId?: string
) {
  const response = await fetchWithTimeout(
    resolveEndpoint(server),
    {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
        'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
        ...(sessionId ? { 'MCP-Session-Id': sessionId } : {}),
        ...(server.headers ?? {}),
      },
      body: JSON.stringify(message),
    },
    timeoutMs
  )

  const sessionHeader = response.headers.get('MCP-Session-Id')
  const contentType = response.headers.get('content-type') ?? ''

  if (message.id === undefined) {
    if (!response.ok && response.status !== 202) {
      const text = await response.text()
      throw new Error(text || 'MCP notification failed')
    }
    return { response: null, sessionId: sessionHeader ?? sessionId }
  }

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `MCP request failed (${response.status})`)
  }

  if (contentType.includes('text/event-stream')) {
    const payload = await readJsonRpcFromSse(response, message.id)
    return { response: payload, sessionId: sessionHeader ?? sessionId }
  }

  const json = (await response.json()) as JsonRpcResponse
  return { response: json, sessionId: sessionHeader ?? sessionId }
}

async function ensureSession(server: McpServerConfig, timeoutMs: number) {
  const initRequest: JsonRpcRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: {
        name: 'my-admin-panel',
        version: '1.0.0',
      },
    },
  }

  const initResult = await mcpRequest(server, initRequest, timeoutMs)
  const sessionId = initResult.sessionId

  if (initResult.response?.error) {
    throw new Error(initResult.response.error.message)
  }

  await mcpRequest(
    server,
    {
      jsonrpc: '2.0',
      method: 'initialized',
      params: {},
    },
    timeoutMs,
    sessionId
  )

  return sessionId
}

async function listToolsStreamable(server: McpServerConfig, timeoutMs: number) {
  const sessionId = await ensureSession(server, timeoutMs)
  const result = await mcpRequest(
    server,
    {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    },
    timeoutMs,
    sessionId
  )

  if (result.response?.error) {
    throw new Error(result.response.error.message)
  }

  const tools = (result.response?.result?.tools ?? []) as McpTool[]
  return tools
}

async function callToolStreamable(
  server: McpServerConfig,
  toolName: string,
  args: Record<string, unknown>,
  timeoutMs: number
) {
  const sessionId = await ensureSession(server, timeoutMs)
  const result = await mcpRequest(
    server,
    {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
      },
    },
    timeoutMs,
    sessionId
  )

  if (result.response?.error) {
    throw new Error(result.response.error.message)
  }

  return result.response?.result ?? {}
}

async function listToolsLegacy(server: McpServerConfig, timeoutMs: number) {
  const response = await fetchWithTimeout(
    resolveEndpoint(server, '/tools/list'),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(server.headers ?? {}),
      },
      body: JSON.stringify({}),
    },
    timeoutMs
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || 'MCP tools/list failed')
  }

  const data = (await response.json()) as { tools?: McpTool[] }
  return data.tools ?? []
}

async function callToolLegacy(
  server: McpServerConfig,
  toolName: string,
  args: Record<string, unknown>,
  timeoutMs: number
) {
  const response = await fetchWithTimeout(
    resolveEndpoint(server, '/tools/call'),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(server.headers ?? {}),
      },
      body: JSON.stringify({ name: toolName, arguments: args }),
    },
    timeoutMs
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || 'MCP tool call failed')
  }

  return (await response.json()) as Record<string, unknown>
}

export async function listMcpTools(server: McpServerConfig, timeoutMs = DEFAULT_TOOL_TIMEOUT_MS) {
  if (isStreamableEndpoint(server.url)) {
    return listToolsStreamable(server, timeoutMs)
  }

  try {
    return await listToolsLegacy(server, timeoutMs)
  } catch (err) {
    const fallbackUrl = `${server.url.replace(/\/$/, '')}/mcp`
    if (fallbackUrl !== server.url) {
      return listToolsStreamable({ ...server, url: fallbackUrl }, timeoutMs)
    }
    throw err
  }
}

export async function callMcpTool(
  server: McpServerConfig,
  toolName: string,
  args: Record<string, unknown>,
  timeoutMs = DEFAULT_TOOL_TIMEOUT_MS
) {
  if (isStreamableEndpoint(server.url)) {
    return callToolStreamable(server, toolName, args, timeoutMs)
  }

  try {
    return await callToolLegacy(server, toolName, args, timeoutMs)
  } catch (err) {
    const fallbackUrl = `${server.url.replace(/\/$/, '')}/mcp`
    if (fallbackUrl !== server.url) {
      return callToolStreamable({ ...server, url: fallbackUrl }, toolName, args, timeoutMs)
    }
    throw err
  }
}
