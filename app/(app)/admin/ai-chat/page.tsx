import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getUserRole } from '@/utils/auth/roles'
import { resolveModulePermissions } from '@/utils/auth/modulePermissions'
import AiChatScenarioManager from '@/features/admin/AiChatScenarioManager'

export default async function AiChatScenarioAdminPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/admin/ai-chat')
  }

  const role = getUserRole(user)
  if (role !== 'admin') {
    redirect('/unauthorized')
  }

  const permissions = await resolveModulePermissions(supabase, user.id, role, 'admin')
  if (!permissions.canWrite) {
    redirect('/unauthorized')
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
              AI 场景管理后台
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              统一维护 AI 场景、Langfuse Prompt Key 与 MCP 配置。
            </p>
          </div>
          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
          >
            返回权限管理
          </Link>
        </header>

        <AiChatScenarioManager />
      </div>
    </div>
  )
}
