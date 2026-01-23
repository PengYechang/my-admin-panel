import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getUserRole } from '@/utils/auth/roles'
import { resolveModulePermissions } from '@/utils/auth/modulePermissions'
import UserTable from '@/features/admin/UserTable'
import ModulePermissionManager from '@/features/admin/ModulePermissionManager'

type ListedUser = {
  id: string
  email: string | null
  app_metadata?: { role?: string }
  user_metadata?: { role?: string }
}

async function hasAdminUser(adminClient: ReturnType<typeof createAdminClient>) {
  let page = 1
  const perPage = 200

  while (page <= 5) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage })
    if (error) {
      return { hasAdmin: false, error: error.message }
    }

    const hasAdmin = (data.users as ListedUser[]).some(
      (item) => item.app_metadata?.role === 'admin' || item.user_metadata?.role === 'admin'
    )

    if (hasAdmin) {
      return { hasAdmin: true, error: null }
    }

    if (data.users.length < perPage) break
    page += 1
  }

  return { hasAdmin: false, error: null }
}

export default async function AdminPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/admin')
  }

  const role = getUserRole(user)
  const bootstrapEmail = process.env.SUPABASE_BOOTSTRAP_ADMIN_EMAIL
  const isBootstrapUser =
    !!bootstrapEmail && !!user.email && bootstrapEmail.toLowerCase() === user.email.toLowerCase()
  let isBootstrapMode = false

  if (role !== 'admin') {
    if (!isBootstrapUser) {
      redirect('/unauthorized')
    }

    const adminClient = createAdminClient()
    const { hasAdmin, error } = await hasAdminUser(adminClient)
    if (error || hasAdmin) {
      redirect('/unauthorized')
    }

    isBootstrapMode = true
  }

  if (!isBootstrapMode) {
    const permissions = await resolveModulePermissions(supabase, user.id, role, 'admin')
    if (!permissions.canRead) {
      redirect('/unauthorized')
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">用户权限管理</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            当前登录：{user.email}（角色：{role}）
          </p>
          {isBootstrapMode ? (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              当前为管理员初始化模式，请将自己设置为 admin。
            </p>
          ) : null}
        </header>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">权限策略说明</h2>
          <ul className="mt-4 space-y-2 text-sm text-zinc-500 dark:text-zinc-400">
            <li>• admin：可访问权限管理与全部业务模块。</li>
            <li>• editor：可访问个人博客等内容管理模块。</li>
            <li>• user：仅访问基础控制台与业务功能。</li>
          </ul>
        </section>

        <UserTable />

        <ModulePermissionManager />

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            如何设置用户角色
          </h2>
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
            角色通过管理员页面设置（写入 app_metadata），并结合模块默认权限与用户覆盖权限生效。
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
            >
              返回首页
            </Link>
            <Link
              href="/blog"
              className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              查看博客模块
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
