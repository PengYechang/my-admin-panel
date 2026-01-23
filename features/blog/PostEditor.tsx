'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type PostEditorProps = {
  postId?: string
  initialTitle?: string
  initialSummary?: string
  initialContent?: string
  initialPublished?: boolean
}

export default function PostEditor({
  postId,
  initialTitle = '',
  initialSummary = '',
  initialContent = '',
  initialPublished = false,
}: PostEditorProps) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  const [title, setTitle] = useState(initialTitle)
  const [summary, setSummary] = useState(initialSummary)
  const [content, setContent] = useState(initialContent)
  const [published, setPublished] = useState(initialPublished)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(null)

    if (!title.trim()) {
      setMessage('标题不能为空。')
      return
    }

    setIsLoading(true)
    try {
      if (postId) {
        const { error } = await supabase
          .from('posts')
          .update({
            title,
            summary,
            content,
            published,
            updated_at: new Date().toISOString(),
            published_at: published ? new Date().toISOString() : null,
          })
          .eq('id', postId)

        if (error) {
          setMessage(`更新失败：${error.message}`)
          return
        }

        setMessage('已更新文章。')
        router.refresh()
        return
      }

      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData.user) {
        setMessage('无法获取用户信息，请重新登录。')
        return
      }

      const { error } = await supabase.from('posts').insert({
        title,
        summary,
        content,
        published,
        author_id: authData.user.id,
        published_at: published ? new Date().toISOString() : null,
      })

      if (error) {
        setMessage(`发布失败：${error.message}`)
        return
      }

      router.replace('/blog')
      router.refresh()
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <label className="block space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
        标题
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2 text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
          placeholder="输入文章标题"
          required
        />
      </label>

      <label className="block space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
        摘要
        <textarea
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          className="h-24 w-full rounded-lg border border-zinc-200 bg-white px-4 py-2 text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
          placeholder="一句话总结文章内容"
        />
      </label>

      <label className="block space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
        正文
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          className="h-56 w-full rounded-lg border border-zinc-200 bg-white px-4 py-2 text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
          placeholder="输入文章内容"
        />
      </label>

      <label className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
        <input
          type="checkbox"
          checked={published}
          onChange={(event) => setPublished(event.target.checked)}
          className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
        />
        立即发布
      </label>

      {message ? <p className="text-sm text-rose-600 dark:text-rose-400">{message}</p> : null}

      <button
        type="submit"
        disabled={isLoading}
        className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isLoading ? '保存中...' : postId ? '更新文章' : '发布文章'}
      </button>
    </form>
  )
}
