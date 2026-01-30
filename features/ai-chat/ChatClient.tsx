'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export type ChatScenario = {
  id: string
  name: string
  description: string | null
  prompt_key: string
  config: Record<string, unknown> | null
}

type ChatMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
  traceWarning?: string
}

type ChatClientProps = {
  scenarios: ChatScenario[]
  userId: string
  initialScenarioId?: string
}

type ConversationSummary = {
  id: string
  title: string
  updatedAt: string
}

function conversationsKey(scenarioId: string) {
  return `ai-chat:conversations:${scenarioId}`
}

function activeConversationKey(scenarioId: string) {
  return `ai-chat:active:${scenarioId}`
}

function loadStoredConversations(scenarioId: string) {
  if (typeof window === 'undefined') return [] as ConversationSummary[]
  const raw = localStorage.getItem(conversationsKey(scenarioId))
  if (!raw) return []
  try {
    const data = JSON.parse(raw) as ConversationSummary[]
    if (!Array.isArray(data)) return []
    return data
  } catch {
    return []
  }
}

function saveStoredConversations(scenarioId: string, conversations: ConversationSummary[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(conversationsKey(scenarioId), JSON.stringify(conversations))
}

function loadStoredActiveConversationId(scenarioId: string) {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(activeConversationKey(scenarioId))
}

function saveStoredActiveConversationId(scenarioId: string, conversationId: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(activeConversationKey(scenarioId), conversationId)
}

export default function ChatClient({ scenarios, userId, initialScenarioId }: ChatClientProps) {
  const router = useRouter()
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(() => {
    if (initialScenarioId && scenarios.some((item) => item.id === initialScenarioId)) {
      return initialScenarioId
    }
    return scenarios[0]?.id ?? ''
  })
  useEffect(() => {
    if (!initialScenarioId) return
    if (scenarios.some((item) => item.id === initialScenarioId)) {
      setSelectedScenarioId(initialScenarioId)
    }
  }, [initialScenarioId, scenarios])

  useEffect(() => {
    if (!selectedScenarioId) return
    router.replace(`/ai-chat?scenario=${selectedScenarioId}`, { scroll: false })
  }, [router, selectedScenarioId])
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [traceWarning, setTraceWarning] = useState<string | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const selectedScenario = useMemo(
    () => scenarios.find((scenario) => scenario.id === selectedScenarioId),
    [scenarios, selectedScenarioId]
  )

  useEffect(() => {
    if (!selectedScenarioId) return

    const storedConversations = loadStoredConversations(selectedScenarioId)
    const storedActive = loadStoredActiveConversationId(selectedScenarioId)

    setConversations(storedConversations)
    setSelectedConversationId(storedActive ?? storedConversations[0]?.id ?? null)
  }, [selectedScenarioId])

  useEffect(() => {
    if (!selectedScenarioId) return
    let active = true

    const loadConversations = async () => {
      try {
        const response = await fetch(`/api/ai-chat/conversations?scenarioId=${selectedScenarioId}`)
        const data = (await response.json()) as {
          conversations?: ConversationSummary[]
          message?: string
        }

        if (!response.ok) {
          throw new Error(data.message ?? '加载失败')
        }

        if (!active) return

        const mergedMap = new Map<string, ConversationSummary>()
        for (const conversation of data.conversations ?? []) {
          mergedMap.set(conversation.id, conversation)
        }
        for (const conversation of loadStoredConversations(selectedScenarioId)) {
          if (!mergedMap.has(conversation.id)) {
            mergedMap.set(conversation.id, conversation)
          }
        }

        const merged = Array.from(mergedMap.values()).sort((a, b) =>
          b.updatedAt.localeCompare(a.updatedAt)
        )

        setConversations(merged)
        saveStoredConversations(selectedScenarioId, merged)
        if (!selectedConversationId && merged.length > 0) {
          setSelectedConversationId(merged[0].id)
          saveStoredActiveConversationId(selectedScenarioId, merged[0].id)
        }
      } catch {
        // ignore
      }
    }

    loadConversations()

    return () => {
      active = false
    }
  }, [selectedScenarioId, selectedConversationId])

  useEffect(() => {
    if (!selectedScenarioId || !selectedConversationId) {
      setMessages([])
      return
    }

    let active = true

    const loadHistory = async () => {
      setError(null)
      try {
        const response = await fetch(
          `/api/ai-chat/history?scenarioId=${selectedScenarioId}&conversationId=${selectedConversationId}`
        )
        const data = (await response.json()) as {
          messages?: ChatMessage[]
          message?: string
          traceWarning?: string
        }

        if (!response.ok) {
          throw new Error(data.message ?? '加载失败')
        }

        if (active) {
          setMessages(data.messages ?? [])
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : '加载失败')
        }
      }
    }

    loadHistory()

    return () => {
      active = false
    }
  }, [selectedScenarioId, selectedConversationId])

  useEffect(() => {
    if (!selectedScenarioId) return
    saveStoredConversations(selectedScenarioId, conversations)
  }, [conversations, selectedScenarioId])

  useEffect(() => {
    if (!selectedScenarioId || !selectedConversationId) return
    saveStoredActiveConversationId(selectedScenarioId, selectedConversationId)
  }, [selectedConversationId, selectedScenarioId])

  const handleSelectScenario = (scenarioId: string) => {
    setSelectedScenarioId(scenarioId)
    setIsSidebarOpen(false)
  }

  const handleSelectConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId)
    setIsSidebarOpen(false)
  }

  const handleNewConversation = () => {
    if (!selectedScenarioId) return
    const id = crypto.randomUUID()
    const nextConversation: ConversationSummary = {
      id,
      title: '新对话',
      updatedAt: new Date().toISOString(),
    }
    setConversations((prev) => [nextConversation, ...prev])
    setSelectedConversationId(id)
    setMessages([])
    setTraceWarning(null)
    setError(null)
  }

  const handleDeleteConversation = async (conversationId: string) => {
    if (!selectedScenarioId) return
    const confirmed = window.confirm('确定要删除这个对话吗？该操作不可恢复。')
    if (!confirmed) return

    try {
      const response = await fetch('/api/ai-chat/conversations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId: selectedScenarioId, conversationId }),
      })
      const data = (await response.json()) as { message?: string }
      if (!response.ok) {
        throw new Error(data.message ?? '删除失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
      return
    }

    const remaining = conversations.filter((item) => item.id !== conversationId)
    setConversations(remaining)
    if (selectedConversationId === conversationId) {
      const fallback = remaining[0]?.id ?? null
      setSelectedConversationId(fallback)
      setMessages([])
    }
  }

  const updateConversationMeta = (conversationId: string, userContent: string) => {
    setConversations((prev) => {
      const updatedAt = new Date().toISOString()
      const next = prev.map((item) =>
        item.id === conversationId
          ? {
              ...item,
              title:
                item.title && item.title !== '新对话'
                  ? item.title
                  : userContent.trim().slice(0, 30) || '新对话',
              updatedAt,
            }
          : item
      )
      if (next.some((item) => item.id === conversationId)) {
        return next.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      }
      return [
        {
          id: conversationId,
          title: userContent.trim().slice(0, 30) || '新对话',
          updatedAt,
        },
        ...next,
      ]
    })
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedScenario || !input.trim()) return

    let conversationId = selectedConversationId
    if (!conversationId) {
      conversationId = crypto.randomUUID()
      setSelectedConversationId(conversationId)
    }

    const userMessage: ChatMessage = {
      id: `${Date.now()}`,
      role: 'user',
      content: input,
      created_at: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setError(null)
    updateConversationMeta(conversationId, userMessage.content)

    try {
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioId: selectedScenario.id,
          conversationId,
          userId,
          messages: [...messages, userMessage].map((item) => ({
            role: item.role,
            content: item.content,
          })),
        }),
      })

      const data = (await response.json()) as {
        message?: string
        reply?: string
        traceWarning?: string
      }

      if (!response.ok) {
        throw new Error(data.message ?? '发送失败')
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-assistant`,
          role: 'assistant',
          content: data.reply ?? '',
          created_at: new Date().toISOString(),
        },
      ])
      setTraceWarning(data.traceWarning ?? null)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送失败')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative flex flex-col gap-6 lg:flex-row">
      <div className="flex items-center justify-between gap-3 lg:hidden">
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">当前场景</p>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {selectedScenario?.name ?? '请选择场景'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsSidebarOpen(true)}
          className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 shadow-sm hover:border-zinc-300 dark:border-zinc-800 dark:text-zinc-200"
        >
          场景/对话
        </button>
      </div>

      {isSidebarOpen ? (
        <button
          type="button"
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          aria-label="关闭侧边栏"
        />
      ) : null}

      <aside
        className={`fixed left-0 top-0 z-40 flex h-full w-72 flex-col gap-6 overflow-y-auto border-r border-zinc-200 bg-white p-5 shadow-lg transition-transform dark:border-zinc-800 dark:bg-zinc-950 lg:static lg:h-auto lg:w-72 lg:rounded-2xl lg:border lg:shadow-sm ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between lg:hidden">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">场景与对话</p>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="text-xs text-zinc-500"
          >
            关闭
          </button>
        </div>

        <div>
          <p className="text-xs font-semibold text-zinc-500">对话场景</p>
          <div className="mt-3 space-y-2">
            {scenarios.map((scenario) => (
              <button
                key={scenario.id}
                type="button"
                onClick={() => handleSelectScenario(scenario.id)}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                  scenario.id === selectedScenarioId
                    ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900'
                    : 'border-zinc-200 text-zinc-600 hover:border-zinc-300 dark:border-zinc-800 dark:text-zinc-300'
                }`}
              >
                <p className="font-medium">{scenario.name}</p>
                <p className="mt-1 text-xs opacity-80">{scenario.description ?? '未填写说明'}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-zinc-500">历史对话</p>
            <button
              type="button"
              onClick={handleNewConversation}
              className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700 hover:border-zinc-300 dark:border-zinc-800 dark:text-zinc-200"
            >
              新建
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {conversations.length === 0 ? (
              <p className="text-xs text-zinc-400">暂无对话</p>
            ) : (
              conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => handleSelectConversation(conversation.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                    conversation.id === selectedConversationId
                      ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900'
                      : 'border-zinc-200 text-zinc-600 hover:border-zinc-300 dark:border-zinc-800 dark:text-zinc-300'
                  }`}
                >
                  <p className="font-medium line-clamp-1">{conversation.title || '新对话'}</p>
                  <p className="mt-1 text-xs opacity-70">{conversation.updatedAt}</p>
                </button>
              ))
            )}
          </div>
        </div>
      </aside>

      <section className="flex-1 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                {selectedScenario?.name ?? '请选择场景'}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Prompt: {selectedScenario?.prompt_key ?? '-'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleNewConversation}
                className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
              >
                新对话
              </button>
              {selectedConversationId ? (
                <button
                  type="button"
                  onClick={() => handleDeleteConversation(selectedConversationId)}
                  className="rounded-full border border-rose-200 px-4 py-2 text-xs font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:border-rose-800 dark:hover:bg-rose-950"
                >
                  删除对话
                </button>
              ) : null}
            </div>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            当前对话：
            {selectedConversationId
              ? (conversations.find((item) => item.id === selectedConversationId)?.title ??
                '新对话')
              : '未选择'}
          </p>
        </div>

        <div className="space-y-4">
          {messages.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              还没有对话，开始输入你的第一句话。
            </p>
          ) : (
            <div className="space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`rounded-xl border px-4 py-3 text-sm ${
                    message.role === 'user'
                      ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900'
                      : 'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200'
                  }`}
                >
                  <p className="text-xs opacity-70">
                    {message.role === 'user' ? '你' : '助手'} · {message.created_at}
                  </p>
                  <div className="mt-2 text-sm leading-relaxed">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code: ({ className, children, ...props }) => {
                          const isBlock = className?.includes('language-')
                          if (isBlock) {
                            return (
                              <code
                                className={`block whitespace-pre-wrap rounded-lg bg-black/80 p-3 text-xs text-white dark:bg-black/70 ${className ?? ''}`}
                                {...props}
                              >
                                {children}
                              </code>
                            )
                          }
                          return (
                            <code
                              className={`rounded bg-zinc-200/70 px-1 py-0.5 text-xs text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 ${className ?? ''}`}
                              {...props}
                            >
                              {children}
                            </code>
                          )
                        },
                        pre: ({ children }) => <div className="overflow-x-auto">{children}</div>,
                        a: ({ children, ...props }) => (
                          <a
                            className="text-blue-600 underline hover:text-blue-500 dark:text-blue-400"
                            {...props}
                          >
                            {children}
                          </a>
                        ),
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {error ? <p className="mt-4 text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}
        {traceWarning ? (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">{traceWarning}</p>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="输入消息..."
            className="h-28 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {selectedScenario?.config
                ? `MCP: ${JSON.stringify(selectedScenario.config)}`
                : '未配置 MCP'}
            </span>
            <button
              type="submit"
              disabled={isLoading || !selectedScenario}
              className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {isLoading ? '发送中...' : '发送'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
