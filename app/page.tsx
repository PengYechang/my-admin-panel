import Link from 'next/link'
import SignOutButton from '@/features/auth/SignOutButton'
import { MODULES } from '@/utils/modules'
import { getAccessibleModules } from '@/utils/auth/modulePermissions'

export default async function Home() {
  const { user, modules } = await getAccessibleModules()
  const moduleAccess = new Map(modules.map((item) => [item.key, item]))

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <main className="mx-auto flex w-full max-w-4xl flex-col items-start gap-10 rounded-2xl border border-zinc-200 bg-white p-10 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-400">
            My Admin Panel
          </p>
          <h1 className="text-4xl font-semibold text-zinc-900 dark:text-zinc-50">
            Refrain的后台管理
          </h1>
          <p className="max-w-2xl text-base text-zinc-500 dark:text-zinc-400">
            该模板已集成 Next.js +
            Supabase，具备登录注册与身份验证流程。你可以在不同路由下拓展业务模块。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {user ? (
            <SignOutButton />
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              前往登录
            </Link>
          )}
          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-full border border-zinc-200 px-5 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
          >
            权限管理
          </Link>
        </div>
        <div className="grid gap-4 text-sm text-zinc-500 dark:text-zinc-400 sm:grid-cols-2">
          {MODULES.map((module) => {
            const access = moduleAccess.get(module.key)
            const disabled = !access?.canRead

            return (
              <div
                key={module.key}
                className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <h3 className="text-zinc-900 dark:text-zinc-50">{module.name}</h3>
                <p className="mt-2">{module.description}</p>
                <div className="mt-4">
                  {disabled ? (
                    <span className="text-xs text-zinc-400">暂无访问权限</span>
                  ) : (
                    <Link
                      href={module.href}
                      className="text-xs font-medium text-zinc-900 hover:text-zinc-700 dark:text-zinc-100 dark:hover:text-white"
                    >
                      进入模块 →
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
