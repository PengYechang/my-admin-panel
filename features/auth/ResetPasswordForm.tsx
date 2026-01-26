'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type Message = { type: 'success' | 'error'; text: string } | null

const MIN_PASSWORD_LENGTH = 6

export default function ResetPasswordForm() {
  const supabase = useMemo(() => createClient(), [])
  const searchParams = useSearchParams()
  const router = useRouter()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<Message>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const exchangeSession = async () => {
      const code = searchParams.get('code')
      if (!code) {
        setIsReady(true)
        return
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) {
        setMessage({ type: 'error', text: '链接已失效，请重新发起重置流程。' })
      }
      setIsReady(true)
    }

    exchangeSession()
  }, [searchParams, supabase])

  const validate = () => {
    if (password.length < MIN_PASSWORD_LENGTH) {
      setMessage({ type: 'error', text: `密码至少需要 ${MIN_PASSWORD_LENGTH} 位。` })
      return false
    }
    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: '两次输入的密码不一致。' })
      return false
    }
    return true
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(null)

    if (!validate()) return

    setIsLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        setMessage({ type: 'error', text: `重置失败：${error.message}` })
        return
      }

      setMessage({ type: 'success', text: '密码已更新，请重新登录。' })
      setTimeout(() => router.replace('/login'), 1200)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-6 space-y-2">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">重置密码</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          设置新的登录密码，完成后自动跳转回登录页。
        </p>
      </div>

      {!isReady ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">正在验证链接...</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
            新密码
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2 text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-200"
              placeholder="至少 6 位"
              required
            />
          </label>

          <label className="block space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
            确认密码
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2 text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-200"
              placeholder="再次输入密码"
              required
            />
          </label>

          {message ? (
            <div
              role="status"
              aria-live="polite"
              className={`rounded-lg px-4 py-3 text-sm ${
                message.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                  : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300'
              }`}
            >
              {message.text}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {isLoading ? '提交中...' : '更新密码'}
          </button>
        </form>
      )}

      <div className="mt-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
        <Link
          href="/login"
          className="font-medium text-zinc-900 hover:text-zinc-700 dark:text-zinc-100 dark:hover:text-white"
        >
          返回登录
        </Link>
      </div>
    </div>
  )
}
