'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

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
}

type ChatClientProps = {
  scenarios: ChatScenario[]
  userId: string
}

function getConversationId(scenarioId: string) {
  const key = `ai-chat:${scenarioId}`
  const existing = sessionStorage.getItem(key)
  if (existing) return existing
  const id = crypto.randomUUID()
  sessionStorage.setItem(key, id)
  return id
}

export default function ChatClient({ scenarios, userId }: ChatClientProps) {
  const router = useRouter()
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(scenarios[0]?.id ?? '')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedScenario = useMemo(
    () => scenarios.find((scenario) => scenario.id === selectedScenarioId),
    [scenarios, selectedScenarioId]
  )

  useEffect(() => {
    if (!selectedScenarioId) return

    let active = true
    const conversationId = getConversationId(selectedScenarioId)

    const loadHistory = async () => {
      setError(null)
      try {
        const response = await fetch(
          `/api/ai-chat/history?scenarioId=${selectedScenarioId}&conversationId=${conversationId}`
        )
        const data = (await response.json()) as { messages?: ChatMessage[]; message?: string }

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
  }, [selectedScenarioId])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedScenario || !input.trim()) return

    const conversationId = getConversationId(selectedScenario.id)
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

      const data = (await response.json()) as { message?: string; reply?: string }

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
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送失败')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-xs font-semibold text-zinc-500">对话场景</p>
        <div className="mt-3 space-y-2">
          {scenarios.map((scenario) => (
            <button
              key={scenario.id}
              type="button"
              onClick={() => setSelectedScenarioId(scenario.id)}
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
      </aside>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-4 space-y-1">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            {selectedScenario?.name ?? '请选择场景'}
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Prompt: {selectedScenario?.prompt_key ?? '-'}
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
                  <p className="mt-2 whitespace-pre-wrap">{message.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {error ? <p className="mt-4 text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}

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
