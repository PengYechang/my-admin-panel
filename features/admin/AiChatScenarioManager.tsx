'use client'

import { useEffect, useMemo, useState } from 'react'

type Scenario = {
  id: string
  name: string
  description: string | null
  prompt_key: string
  config: Record<string, unknown> | null
  created_at: string
}

type ResponseBody = {
  scenarios?: Scenario[]
  message?: string
}

type McpServerOption = {
  name: string
  url: string
}

type McpTool = {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

type PromptOption = {
  key: string
  label: string
}

type FormState = {
  id: string
  name: string
  description: string
  promptKey: string
  serverNames: string[]
  toolRoutingText: string
  timeoutMs: string
}

const EMPTY_FORM: FormState = {
  id: '',
  name: '',
  description: '',
  promptKey: '',
  serverNames: [],
  toolRoutingText: '',
  timeoutMs: '',
}

export default function AiChatScenarioManager() {
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [serverOptions, setServerOptions] = useState<McpServerOption[]>([])
  const [toolsByServer, setToolsByServer] = useState<Record<string, McpTool[]>>({})
  const [toolErrors, setToolErrors] = useState<Record<string, string>>({})
  const [toolLoading, setToolLoading] = useState<Record<string, boolean>>({})
  const [promptOptions, setPromptOptions] = useState<PromptOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isEditing = useMemo(() => !!form.id, [form.id])

  const fetchScenarios = async () => {
    setIsLoading(true)
    setError(null)
    setFeedback(null)

    try {
      const response = await fetch('/api/admin/ai-chat')
      const data = (await response.json()) as ResponseBody

      if (!response.ok) {
        throw new Error(data.message ?? '加载失败')
      }

      setScenarios(data.scenarios ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchScenarios()
  }, [])

  useEffect(() => {
    let active = true

    const fetchServers = async () => {
      try {
        const response = await fetch('/api/admin/mcp/servers')
        const data = (await response.json()) as { servers?: McpServerOption[]; message?: string }

        if (!response.ok) {
          throw new Error(data.message ?? '加载 MCP 失败')
        }

        if (active) {
          setServerOptions(data.servers ?? [])
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : '加载 MCP 失败')
        }
      }
    }

    fetchServers()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    const fetchPrompts = async () => {
      try {
        const response = await fetch('/api/admin/langfuse/prompts')
        const data = (await response.json()) as { prompts?: PromptOption[]; message?: string }

        if (!response.ok) {
          throw new Error(data.message ?? '加载 Prompt 失败')
        }

        if (active) {
          setPromptOptions(data.prompts ?? [])
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : '加载 Prompt 失败')
        }
      }
    }

    fetchPrompts()

    return () => {
      active = false
    }
  }, [])

  const parseToolRouting = () => {
    if (!form.toolRoutingText.trim()) return undefined
    try {
      return JSON.parse(form.toolRoutingText) as Record<string, string>
    } catch {
      throw new Error('toolRouting JSON 格式错误')
    }
  }

  const loadTools = async (serverName: string) => {
    setToolLoading((prev) => ({ ...prev, [serverName]: true }))
    setToolErrors((prev) => ({ ...prev, [serverName]: '' }))

    try {
      const response = await fetch(`/api/admin/mcp/tools?serverName=${serverName}`)
      const data = (await response.json()) as { tools?: McpTool[]; message?: string }

      if (!response.ok) {
        throw new Error(data.message ?? '验证失败')
      }

      setToolsByServer((prev) => ({ ...prev, [serverName]: data.tools ?? [] }))
    } catch (err) {
      setToolErrors((prev) => ({
        ...prev,
        [serverName]: err instanceof Error ? err.message : '验证失败',
      }))
    } finally {
      setToolLoading((prev) => ({ ...prev, [serverName]: false }))
    }
  }

  const getScenarioServerNames = (scenario: Scenario) => {
    const config = scenario.config as Record<string, unknown> | null
    if (!config) return []

    const directServerNames = config.serverNames
    if (Array.isArray(directServerNames)) {
      return directServerNames.filter((item) => typeof item === 'string') as string[]
    }

    const mcp = config.mcp as Record<string, unknown> | undefined
    if (mcp && Array.isArray(mcp.serverNames)) {
      return mcp.serverNames.filter((item) => typeof item === 'string') as string[]
    }

    if (mcp && Array.isArray(mcp.servers)) {
      return (mcp.servers as Array<{ name?: string }>)
        .map((item) => item.name ?? '')
        .filter(Boolean)
    }

    if (Array.isArray(config.servers)) {
      return (config.servers as Array<{ name?: string }>)
        .map((item) => item.name ?? '')
        .filter(Boolean)
    }

    return []
  }

  const handleEdit = (scenario: Scenario) => {
    const serverNames = getScenarioServerNames(scenario)
    const config = scenario.config as Record<string, unknown> | null
    const mcp = config?.mcp as Record<string, unknown> | undefined
    const toolRouting = (mcp?.toolRouting ?? config?.toolRouting) as
      | Record<string, string>
      | undefined
    const timeoutMs = (mcp?.timeoutMs ?? config?.timeoutMs) as number | undefined

    setForm({
      id: scenario.id,
      name: scenario.name,
      description: scenario.description ?? '',
      promptKey: scenario.prompt_key,
      serverNames,
      toolRoutingText: toolRouting ? JSON.stringify(toolRouting, null, 2) : '',
      timeoutMs: timeoutMs ? String(timeoutMs) : '',
    })
    setFeedback(null)
    setError(null)
  }

  const resetForm = () => {
    setForm(EMPTY_FORM)
  }

  const parseTimeoutMs = () => {
    if (!form.timeoutMs.trim()) return undefined
    const value = Number(form.timeoutMs)
    if (Number.isNaN(value) || value <= 0) {
      throw new Error('timeoutMs 必须为正数')
    }
    return Math.round(value)
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError(null)
    setFeedback(null)

    try {
      if (!form.name.trim() || !form.promptKey.trim()) {
        throw new Error('请填写场景名称与 Prompt Key')
      }

      const toolRouting = parseToolRouting()
      const timeoutMs = parseTimeoutMs()
      const mcpConfig = form.serverNames.length
        ? {
            serverNames: form.serverNames,
            toolRouting,
            timeoutMs,
          }
        : undefined

      const config = mcpConfig ? { mcp: mcpConfig } : null
      const payload = {
        id: form.id,
        name: form.name.trim(),
        description: form.description.trim() || null,
        promptKey: form.promptKey.trim(),
        config,
      }

      const response = await fetch('/api/admin/ai-chat', {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = (await response.json()) as { message?: string }
      if (!response.ok) {
        throw new Error(data.message ?? '保存失败')
      }

      setFeedback(isEditing ? '场景已更新。' : '场景已创建。')
      resetForm()
      await fetchScenarios()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (scenarioId: string) => {
    if (!window.confirm('确认删除该场景吗？此操作不可恢复。')) return

    setIsSubmitting(true)
    setError(null)
    setFeedback(null)

    try {
      const response = await fetch('/api/admin/ai-chat', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: scenarioId }),
      })

      const data = (await response.json()) as { message?: string }
      if (!response.ok) {
        throw new Error(data.message ?? '删除失败')
      }

      setFeedback('场景已删除。')
      if (form.id === scenarioId) {
        resetForm()
      }
      await fetchScenarios()
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">AI 场景管理</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            维护场景名称、Langfuse Prompt Key 与 MCP 配置。
          </p>
        </div>
        <button
          type="button"
          onClick={() => resetForm()}
          className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
        >
          新建场景
        </button>
      </div>

      {feedback ? (
        <p className="mb-3 text-sm text-emerald-600 dark:text-emerald-400">{feedback}</p>
      ) : null}
      {error ? <p className="mb-3 text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-zinc-500">场景名称</label>
            <input
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
              placeholder="例如：产品问答"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-500">场景说明</label>
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, description: event.target.value }))
              }
              className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
              rows={3}
              placeholder="可选，简要说明用途"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-500">Langfuse Prompt Key</label>
            <input
              value={form.promptKey}
              onChange={(event) => setForm((prev) => ({ ...prev, promptKey: event.target.value }))}
              list="langfuse-prompt-options"
              className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
              placeholder="例如：customer_support"
            />
            <datalist id="langfuse-prompt-options">
              {promptOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </datalist>
            {promptOptions.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                未配置 Prompt 下拉选项，可在环境变量 LANGFUSE_PROMPT_OPTIONS 中维护。
              </p>
            ) : null}
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-500">选择 MCP Server</label>
            {serverOptions.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                暂无可用 MCP，请先配置 MCP_SERVER_REGISTRY。
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                {serverOptions.map((server) => (
                  <div
                    key={server.name}
                    className="rounded-lg border border-zinc-200 bg-white p-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                  >
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.serverNames.includes(server.name)}
                        onChange={(event) => {
                          setForm((prev) => {
                            if (event.target.checked) {
                              return { ...prev, serverNames: [...prev.serverNames, server.name] }
                            }
                            return {
                              ...prev,
                              serverNames: prev.serverNames.filter((item) => item !== server.name),
                            }
                          })
                        }}
                      />
                      <span className="font-medium">{server.name}</span>
                      <span className="text-xs text-zinc-400">{server.url}</span>
                    </label>
                    <div className="mt-2 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => loadTools(server.name)}
                        disabled={toolLoading[server.name]}
                        className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
                      >
                        {toolLoading[server.name] ? '验证中...' : '验证并查看工具'}
                      </button>
                      {toolErrors[server.name] ? (
                        <span className="text-xs text-rose-500">{toolErrors[server.name]}</span>
                      ) : null}
                    </div>
                    {toolsByServer[server.name]?.length ? (
                      <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                        可用工具：{toolsByServer[server.name].map((tool) => tool.name).join(', ')}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-500">toolRouting（可选）</label>
            <textarea
              value={form.toolRoutingText}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, toolRoutingText: event.target.value }))
              }
              className="mt-2 h-32 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
              placeholder='{"feishu.search":"feishu-mcp-word"}'
            />
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              可留空；保存前会校验 JSON 格式。
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-500">timeoutMs（可选）</label>
            <input
              value={form.timeoutMs}
              onChange={(event) => setForm((prev) => ({ ...prev, timeoutMs: event.target.value }))}
              className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
              placeholder="8000"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {isSubmitting ? '保存中...' : isEditing ? '更新场景' : '创建场景'}
            </button>
            {isEditing ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
              >
                取消编辑
              </button>
            ) : null}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-zinc-500">已有场景</p>
          {isLoading ? (
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">正在加载场景...</p>
          ) : scenarios.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">暂无场景。</p>
          ) : (
            <div className="mt-3 space-y-3">
              {scenarios.map((scenario) => (
                <div
                  key={scenario.id}
                  className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                        {scenario.name}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        Prompt: {scenario.prompt_key}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(scenario)}
                        className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-white dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(scenario.id)}
                        disabled={isSubmitting}
                        className="rounded-full border border-rose-200 px-3 py-1 text-xs font-medium text-rose-600 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/40 dark:text-rose-300 dark:hover:border-rose-400 dark:hover:bg-rose-500/10"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    {scenario.description ?? '未填写说明'}
                  </p>
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    MCP: {getScenarioServerNames(scenario).join(', ') || '未配置'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
