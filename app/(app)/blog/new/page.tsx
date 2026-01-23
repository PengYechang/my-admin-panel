import Link from 'next/link'
import { requireModuleWriteAccess } from '@/utils/auth/modulePermissions'
import PostEditor from '@/features/blog/PostEditor'

export default async function BlogCreatePage() {
  await requireModuleWriteAccess('blog', '/login?next=/blog/new')

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">新增文章</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">填写内容后发布或保存为草稿。</p>
        </header>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <PostEditor />
        </section>

        <Link
          href="/blog"
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← 返回博客列表
        </Link>
      </div>
    </div>
  )
}
