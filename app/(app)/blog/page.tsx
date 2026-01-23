import Link from 'next/link'
import { requireModuleAccess } from '@/utils/auth/modulePermissions'

export default async function BlogPage() {
  const { supabase } = await requireModuleAccess('blog', '/login?next=/blog')

  const { data: posts, error } = await supabase
    .from('posts')
    .select('id,title,summary,created_at,published')
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">个人博客</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              仅 admin / editor 可访问该模块
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/blog/new"
              className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              新增文章
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
            >
              返回首页
            </Link>
          </div>
        </header>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">最新文章</h2>

          {error ? (
            <p className="mt-4 text-sm text-rose-600 dark:text-rose-400">
              加载失败：{error.message}
            </p>
          ) : posts && posts.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {posts.map((post) => (
                <li
                  key={post.id}
                  className="rounded-xl border border-zinc-200 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-300"
                >
                  <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                    {post.title}
                  </h3>
                  {post.summary ? <p className="mt-2">{post.summary}</p> : null}
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                    <span>{post.created_at}</span>
                    <span className="rounded-full border border-zinc-200 px-2 py-0.5 dark:border-zinc-700">
                      {post.published ? '已发布' : '草稿'}
                    </span>
                    <Link
                      href={`/blog/${post.id}/edit`}
                      className="font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
                    >
                      编辑
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
              还没有文章，欢迎添加你的第一篇博客内容。
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
