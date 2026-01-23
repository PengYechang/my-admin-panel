import Link from 'next/link'
import { requireModuleAccess } from '@/utils/auth/modulePermissions'
import MemoForm from '@/features/memo/MemoForm'

export default async function MemoPage() {
  const { supabase, user } = await requireModuleAccess('memo', '/login?next=/memo')

  const { data: memos, error } = await supabase
    .from('memos')
    .select('id,content,created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">备忘录</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">记录重要事项与灵感</p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
          >
            返回首页
          </Link>
        </header>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">新增备忘</h2>
          <div className="mt-4">
            <MemoForm userId={user.id} />
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">我的备忘</h2>

          {error ? (
            <p className="mt-4 text-sm text-rose-600 dark:text-rose-400">
              加载失败：{error.message}
            </p>
          ) : memos && memos.length > 0 ? (
            <ul className="mt-4 space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
              {memos.map((memo) => (
                <li
                  key={memo.id}
                  className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
                >
                  <p>{memo.content}</p>
                  <p className="mt-2 text-xs text-zinc-400">{memo.created_at}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
              暂无备忘，开始记录第一条吧。
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
