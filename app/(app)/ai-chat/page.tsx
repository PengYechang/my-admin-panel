import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getUserRole } from '@/utils/auth/roles'
import { resolveModulePermissions } from '@/utils/auth/modulePermissions'
import ChatClient from '@/features/ai-chat/ChatClient'

type AiChatPageProps = {
  searchParams?: Promise<{ scenario?: string }>
}

export default async function AiChatPage({ searchParams }: AiChatPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const role = getUserRole(user)
    const permissions = await resolveModulePermissions(supabase, user.id, role, 'ai-chat')
    if (!permissions.canRead) {
      redirect('/unauthorized')
    }
  }
  let scenarios: Array<{
    id: string
    name: string
    description: string | null
    prompt_key: string
    config: Record<string, unknown> | null
  }> | null = null
  let error: Error | null = null

  try {
    const scenarioClient = user ? supabase : createAdminClient()
    const response = await scenarioClient
      .from('ai_chat_scenarios')
      .select('id,name,description,prompt_key,config')
      .order('created_at', { ascending: true })

    if (response.error) {
      error = new Error(response.error.message)
    } else {
      scenarios = response.data ?? []
    }
  } catch (err) {
    error = err instanceof Error ? err : new Error('场景加载失败')
    scenarios = []
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">AI 聊天</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              多场景对话，自动关联 Langfuse Prompt。
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
          >
            返回首页
          </Link>
        </header>

        {error ? (
          <p className="text-sm text-rose-600 dark:text-rose-400">{error.message}</p>
        ) : scenarios && scenarios.length > 0 ? (
          <ChatClient
            scenarios={scenarios}
            userId={user?.id}
            initialScenarioId={resolvedSearchParams?.scenario}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
            尚未配置聊天场景，请先在数据库中创建 ai_chat_scenarios 记录。
          </div>
        )}
      </div>
    </div>
  )
}
