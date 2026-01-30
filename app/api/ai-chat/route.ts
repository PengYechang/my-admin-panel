import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { resolveMcpServers, type McpServerConfig } from '@/utils/mcp/registry'
import { listMcpTools, callMcpTool } from '@/utils/mcp/client'

const DEFAULT_TEMPERATURE = 0.7
const DEFAULT_TOOL_TIMEOUT_MS = 8000

type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

type TraceMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

function toTraceRole(role: OpenAIMessage['role']): TraceMessage['role'] {
  return role === 'tool' ? 'assistant' : role
}

type ToolCall = {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

type OpenAIUsage = {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
}

type OpenAIMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string | null
  tool_call_id?: string
  tool_calls?: ToolCall[]
}

type McpConfig = {
  servers: McpServerConfig[]
  toolRouting?: Record<string, string>
  timeoutMs?: number
}

type OpenAITool = {
  type: 'function'
  function: {
    name: string
    description?: string
    parameters: Record<string, unknown>
  }
}

type RequestBody = {
  scenarioId?: string
  conversationId?: string
  userId?: string
  messages?: ChatMessage[]
}

type LangfusePrompt = {
  prompt?: string
  config?: Record<string, unknown>
}

function getPromptVariables() {
  const now = new Date()
  return {
    current_date: now.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }),
    current_year: String(now.getFullYear()),
  }
}

function interpolatePrompt(prompt: string, variables: Record<string, string>) {
  return prompt.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, key) => {
    if (key in variables) return variables[key] ?? ''
    return match
  })
}

function getMcpConfig(config: Record<string, unknown> | null | undefined): McpConfig | null {
  if (!config) return null

  const directServers = config.servers
  if (Array.isArray(directServers)) {
    return {
      servers: directServers as McpServerConfig[],
      toolRouting: (config.toolRouting as Record<string, string> | undefined) ?? undefined,
      timeoutMs: (config.timeoutMs as number | undefined) ?? undefined,
    }
  }

  const directServerNames = config.serverNames
  if (Array.isArray(directServerNames)) {
    const servers = resolveMcpServers(directServerNames as string[])
    if (servers.length === 0) return null
    return {
      servers,
      toolRouting: (config.toolRouting as Record<string, string> | undefined) ?? undefined,
      timeoutMs: (config.timeoutMs as number | undefined) ?? undefined,
    }
  }

  const mcp = config.mcp as Record<string, unknown> | undefined
  if (mcp && Array.isArray(mcp.servers)) {
    return {
      servers: mcp.servers as McpServerConfig[],
      toolRouting: (mcp.toolRouting as Record<string, string> | undefined) ?? undefined,
      timeoutMs: (mcp.timeoutMs as number | undefined) ?? undefined,
    }
  }

  if (mcp && Array.isArray(mcp.serverNames)) {
    const servers = resolveMcpServers(mcp.serverNames as string[])
    if (servers.length === 0) return null
    return {
      servers,
      toolRouting: (mcp.toolRouting as Record<string, string> | undefined) ?? undefined,
      timeoutMs: (mcp.timeoutMs as number | undefined) ?? undefined,
    }
  }

  return null
}

async function prepareMcpTools(mcpConfig: McpConfig | null) {
  if (!mcpConfig || mcpConfig.servers.length === 0) {
    return { tools: [] as OpenAITool[], routing: {} as Record<string, McpServerConfig> }
  }

  const timeoutMs = mcpConfig.timeoutMs ?? DEFAULT_TOOL_TIMEOUT_MS
  const toolsByServer = await Promise.all(
    mcpConfig.servers.map(async (server) => {
      try {
        const tools = await listMcpTools(server, timeoutMs)
        return { server, tools }
      } catch {
        return { server, tools: [] }
      }
    })
  )

  const routing: Record<string, McpServerConfig> = {}
  const toolRouting = mcpConfig.toolRouting ?? {}

  toolsByServer.forEach(({ server, tools }) => {
    tools.forEach((tool) => {
      if (!routing[tool.name]) {
        routing[tool.name] = server
      }
    })
  })

  Object.entries(toolRouting).forEach(([toolName, serverName]) => {
    const server = mcpConfig.servers.find((item) => item.name === serverName)
    if (server) {
      routing[toolName] = server
    }
  })

  const tools: OpenAITool[] = toolsByServer.flatMap(({ tools: items }) =>
    items.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema ?? { type: 'object', properties: {} },
      },
    }))
  )

  return { tools, routing, timeoutMs }
}

async function getLangfusePrompt(promptKey: string): Promise<LangfusePrompt> {
  const host = process.env.LANGFUSE_HOST
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY
  const secretKey = process.env.LANGFUSE_SECRET_KEY

  if (!host || !publicKey || !secretKey) {
    return { prompt: promptKey }
  }

  try {
    const auth = Buffer.from(`${publicKey}:${secretKey}`).toString('base64')
    const response = await fetch(`${host}/api/public/v2/prompts/${promptKey}`, {
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      return { prompt: promptKey }
    }

    const data = (await response.json()) as Record<string, unknown>
    const prompt = (data.prompt as string | undefined) ?? promptKey
    const config = (data.config as Record<string, unknown> | undefined) ?? undefined

    return { prompt, config }
  } catch {
    return { prompt: promptKey }
  }
}

async function sendToLangfuseTrace(payload: {
  promptKey: string
  scenarioId: string
  userId: string
  model: string
  input: TraceMessage[]
  output: string
  metadata: Record<string, unknown>
  traceId: string
  generations: Array<{
    id: string
    name: string
    model: string
    input: TraceMessage[]
    output: string
    startTime: string
    endTime: string
    usage?: OpenAIUsage
  }>
  toolSpans: Array<{
    id: string
    name: string
    input: Record<string, unknown>
    output: unknown
    startTime: string
    endTime: string
    metadata?: Record<string, unknown>
  }>
}) {
  const host = process.env.LANGFUSE_HOST
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY
  const secretKey = process.env.LANGFUSE_SECRET_KEY

  if (!host || !publicKey || !secretKey) {
    return { ok: false, error: 'Langfuse 未配置，跳过上报。' }
  }

  try {
    const safeInput = Array.isArray(payload.input) ? payload.input : []
    const safeOutput = payload.output ?? ''
    const now = new Date().toISOString()
    const auth = Buffer.from(`${publicKey}:${secretKey}`).toString('base64')
    const response = await fetch(`${host}/api/public/ingestion`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        batch: [
          {
            id: crypto.randomUUID(),
            timestamp: now,
            type: 'trace-create',
            body: {
              id: payload.traceId,
              timestamp: now,
              name: payload.promptKey,
              userId: payload.userId,
              metadata: payload.metadata,
              input: safeInput,
              output: safeOutput,
            },
          },
          ...payload.generations.map((generation) => ({
            id: crypto.randomUUID(),
            timestamp: generation.endTime,
            type: 'generation-create',
            body: {
              id: generation.id,
              traceId: payload.traceId,
              name: generation.name,
              model: generation.model,
              startTime: generation.startTime,
              completionStartTime: generation.startTime,
              endTime: generation.endTime,
              input: generation.input,
              output: generation.output,
              usageDetails: generation.usage,
            },
          })),
          ...payload.toolSpans.map((span) => ({
            id: crypto.randomUUID(),
            timestamp: span.endTime,
            type: 'span-create',
            body: {
              id: span.id,
              traceId: payload.traceId,
              name: span.name,
              startTime: span.startTime,
              endTime: span.endTime,
              input: span.input,
              output: span.output,
              metadata: span.metadata ?? null,
            },
          })),
        ],
      }),
    })
    if (!response.ok) {
      const text = await response.text()
      return {
        ok: false,
        error: `Langfuse 上报失败 (${response.status} ${response.statusText})${text ? ` - ${text}` : ''}`,
      }
    }

    const result = (await response.json().catch(() => null)) as
      | { errors?: Array<{ message?: string; error?: unknown }> }
      | null
    const ingestionErrors = result?.errors ?? []
    if (Array.isArray(ingestionErrors) && ingestionErrors.length > 0) {
      const message = ingestionErrors
        .map((item) => item.message || (item.error ? JSON.stringify(item.error) : 'unknown error'))
        .join('; ')
      return { ok: false, error: `Langfuse 上报失败 (207) - ${message}` }
    }

    return { ok: true }
  } catch {
    return { ok: false, error: 'Langfuse 上报异常，请检查网络与密钥。' }
  }
}

async function callOpenAI(messages: OpenAIMessage[], tools?: OpenAITool[]) {
  const apiKey = process.env.OPENAI_API_KEY
  const baseUrl = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1'
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'

  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY')
  }

  const startAt = Date.now()
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: DEFAULT_TEMPERATURE,
      tools: tools && tools.length > 0 ? tools : undefined,
      tool_choice: tools && tools.length > 0 ? 'auto' : undefined,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || 'OpenAI request failed')
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null; tool_calls?: ToolCall[] } }>
    usage?: OpenAIUsage
  }

  const message = data.choices?.[0]?.message
  return {
    content: message?.content ?? '',
    toolCalls: message?.tool_calls ?? [],
    usage: data.usage,
    startedAt: new Date(startAt).toISOString(),
    endedAt: new Date().toISOString(),
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as RequestBody
  const { scenarioId, conversationId, userId, messages } = body

  if (!scenarioId || !conversationId || !messages) {
    return NextResponse.json({ message: 'Missing required fields' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user && userId && user.id !== userId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  // 使用 admin 客户端查询场景，绕过 RLS 限制（支持游客访问）
  const adminClient = createAdminClient()
  const { data: scenario, error: scenarioError } = await adminClient
    .from('ai_chat_scenarios')
    .select('id,prompt_key,config')
    .eq('id', scenarioId)
    .single()

  if (scenarioError || !scenario) {
    return NextResponse.json({ message: 'Scenario not found' }, { status: 404 })
  }

  const { prompt, config } = await getLangfusePrompt(scenario.prompt_key)
  const promptVariables = {
    ...getPromptVariables(),
    ...((config?.promptVariables as Record<string, string> | undefined) ?? {}),
  }
  const systemMessage: OpenAIMessage = {
    role: 'system',
    content: prompt ? interpolatePrompt(prompt, promptVariables) : scenario.prompt_key,
  }

  const mcpConfig = getMcpConfig((config ?? scenario.config ?? null) as Record<string, unknown>)
  const { tools, routing, timeoutMs } = await prepareMcpTools(mcpConfig)

  const promptMessages: OpenAIMessage[] = [systemMessage, ...messages]
  const traceId = crypto.randomUUID()
  const generations: Array<{
    id: string
    name: string
    model: string
    input: ChatMessage[]
    output: string
    startTime: string
    endTime: string
    usage?: OpenAIUsage
  }> = []
  const toolSpans: Array<{
    id: string
    name: string
    input: Record<string, unknown>
    output: unknown
    startTime: string
    endTime: string
    metadata?: Record<string, unknown>
  }> = []

  const firstResponse = await callOpenAI(promptMessages, tools)
  const firstInput: TraceMessage[] = promptMessages.map<TraceMessage>((item) => ({
    role: toTraceRole(item.role),
    content: item.content ?? '',
  }))
  generations.push({
    id: crypto.randomUUID(),
    name: scenario.prompt_key,
    model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    input: firstInput,
    output: firstResponse.content ?? '',
    startTime: firstResponse.startedAt,
    endTime: firstResponse.endedAt,
    usage: firstResponse.usage,
  })
  let reply = firstResponse.content

  if (firstResponse.toolCalls && firstResponse.toolCalls.length > 0) {
    const toolMessages: OpenAIMessage[] = []

    for (const toolCall of firstResponse.toolCalls) {
      const toolName = toolCall.function.name
      const server = routing[toolName]

      if (!server) {
        toolMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: `Tool not routed: ${toolName}`,
        })
        continue
      }

      let args: Record<string, unknown> = {}
      try {
        args = toolCall.function.arguments ? JSON.parse(toolCall.function.arguments) : {}
      } catch {
        args = {}
      }

      const toolStart = new Date().toISOString()
      try {
        const result = await callMcpTool(server, toolName, args, timeoutMs ?? DEFAULT_TOOL_TIMEOUT_MS)
        const toolEnd = new Date().toISOString()
        toolSpans.push({
          id: crypto.randomUUID(),
          name: `mcp:${toolName}`,
          input: args,
          output: result,
          startTime: toolStart,
          endTime: toolEnd,
          metadata: {
            server: server.name,
            url: server.url,
          },
        })
        toolMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: typeof result === 'string' ? result : JSON.stringify(result),
        })
      } catch (err) {
        const toolEnd = new Date().toISOString()
        toolSpans.push({
          id: crypto.randomUUID(),
          name: `mcp:${toolName}`,
          input: args,
          output: err instanceof Error ? err.message : 'Tool call failed',
          startTime: toolStart,
          endTime: toolEnd,
          metadata: {
            server: server.name,
            url: server.url,
            error: true,
          },
        })
        toolMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: err instanceof Error ? err.message : 'Tool call failed',
        })
      }
    }

    const secondResponse = await callOpenAI(
      [
        ...promptMessages,
        {
          role: 'assistant',
          content: firstResponse.content ?? '',
          tool_calls: firstResponse.toolCalls,
        },
        ...toolMessages,
      ],
      tools
    )

    const secondInput: TraceMessage[] = [
      ...promptMessages.map<TraceMessage>((item) => ({
        role: toTraceRole(item.role),
        content: item.content ?? '',
      })),
      {
        role: 'assistant',
        content: firstResponse.content ?? '',
      } as TraceMessage,
      ...toolMessages.map<TraceMessage>((item) => ({
        role: 'assistant',
        content: item.content ?? '',
      })),
    ]
    generations.push({
      id: crypto.randomUUID(),
      name: scenario.prompt_key,
      model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      input: secondInput,
      output: secondResponse.content ?? '',
      startTime: secondResponse.startedAt,
      endTime: secondResponse.endedAt,
      usage: secondResponse.usage,
    })

    reply = secondResponse.content
  }

  if (user) {
    const { error: insertError } = await supabase.from('ai_chat_messages').insert([
      {
        user_id: user.id,
        scenario_id: scenarioId,
        conversation_id: conversationId,
        role: 'user',
        content: messages[messages.length - 1]?.content ?? '',
      },
      {
        user_id: user.id,
        scenario_id: scenarioId,
        conversation_id: conversationId,
        role: 'assistant',
        content: reply,
      },
    ])

    if (insertError) {
      return NextResponse.json({ message: insertError.message }, { status: 500 })
    }
  }

  const traceResult = await sendToLangfuseTrace({
    promptKey: scenario.prompt_key,
    scenarioId,
    userId: user?.id ?? `guest:${conversationId}`,
    model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    traceId,
    input: promptMessages.map((item) => ({
      role: toTraceRole(item.role),
      content: item.content ?? '',
    })),
    output: reply,
    metadata: {
      scenarioId,
      config: config ?? scenario.config ?? null,
      mcp: mcpConfig ?? null,
    },
    generations,
    toolSpans,
  })

  return NextResponse.json({ reply, traceWarning: traceResult.ok ? undefined : traceResult.error })
}
