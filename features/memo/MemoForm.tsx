'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type MemoFormProps = {
  userId: string
}

export default function MemoForm({ userId }: MemoFormProps) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [content, setContent] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(null)

    if (!content.trim()) {
      setMessage('请输入备忘内容。')
      return
    }

    setIsLoading(true)
    try {
      const { error } = await supabase.from('memos').insert({
        content,
        user_id: userId,
      })

      if (error) {
        setMessage(`保存失败：${error.message}`)
        return
      }

      setContent('')
      router.refresh()
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        className="h-28 w-full rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
        placeholder="写下你的备忘..."
      />
      {message ? <p className="text-sm text-rose-600 dark:text-rose-400">{message}</p> : null}
      <button
        type="submit"
        disabled={isLoading}
        className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isLoading ? '保存中...' : '新增备忘'}
      </button>
    </form>
  )
}
