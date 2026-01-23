import Link from 'next/link'
import { requireModuleWriteAccess } from '@/utils/auth/modulePermissions'
import PostEditor from '@/features/blog/PostEditor'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function BlogEditPage({ params }: PageProps) {
  const { id } = await params
  const { supabase } = await requireModuleWriteAccess('blog', `/login?next=/blog/${id}/edit`)

  const { data: post, error } = await supabase
    .from('posts')
    .select('id,title,summary,content,published')
    .eq('id', id)
    .single()

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">编辑文章</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">更新内容并保存。</p>
        </header>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          {error || !post ? (
            <p className="text-sm text-rose-600 dark:text-rose-400">
              无法加载文章信息，请返回列表重试。
            </p>
          ) : (
            <PostEditor
              postId={post.id}
              initialTitle={post.title ?? ''}
              initialSummary={post.summary ?? ''}
              initialContent={post.content ?? ''}
              initialPublished={post.published ?? false}
            />
          )}
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
