'use client'

import { useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type AuthMode = 'login' | 'signup'
type Message = { type: 'success' | 'error'; text: string } | null

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 6

export default function AuthForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])

  const next = searchParams.get('next') ?? '/'
  const safeNext = next.startsWith('/') ? next : '/'
  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'login'

  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<Message>(null)

  const handleModeChange = (nextMode: AuthMode) => {
    setMode(nextMode)
    setMessage(null)
  }

  const validate = () => {
    if (!EMAIL_REGEX.test(email)) {
      setMessage({ type: 'error', text: '请输入正确的邮箱地址。' })
      return false
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setMessage({
        type: 'error',
        text: `密码至少需要 ${MIN_PASSWORD_LENGTH} 位。`,
      })
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
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          setMessage({ type: 'error', text: `登录失败：${error.message}` })
          return
        }

        router.refresh()
        router.replace(safeNext)
        return
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}`,
        },
      })

      if (error) {
        setMessage({ type: 'error', text: `注册失败：${error.message}` })
        return
      }

      setMessage({
        type: 'success',
        text: '注册成功，请前往邮箱验证后再登录。',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-6 space-y-2">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          {mode === 'login' ? '欢迎回来' : '创建你的账号'}
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          使用邮箱快速完成登录与注册，进入后台管理。
        </p>
      </div>

      <div className="mb-6 flex rounded-full bg-zinc-100 p-1 text-sm dark:bg-zinc-900">
        <button
          type="button"
          onClick={() => handleModeChange('login')}
          className={`flex-1 rounded-full px-3 py-2 transition ${
            mode === 'login'
              ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50'
              : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50'
          }`}
        >
          登录
        </button>
        <button
          type="button"
          onClick={() => handleModeChange('signup')}
          className={`flex-1 rounded-full px-3 py-2 transition ${
            mode === 'signup'
              ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50'
              : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50'
          }`}
        >
          注册
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
          邮箱
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2 text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-200"
            placeholder="name@company.com"
            required
          />
        </label>

        <label className="block space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
          密码
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2 pr-14 text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-200"
              placeholder="至少 6 位"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              {showPassword ? '隐藏' : '显示'}
            </button>
          </div>
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
          {isLoading ? '处理中...' : mode === 'login' ? '登录并进入系统' : '注册并发送验证邮件'}
        </button>
      </form>

      <div className="mt-6 space-y-2 text-center text-xs text-zinc-500 dark:text-zinc-400">
        {mode === 'login' ? (
          <Link
            href="/forgot-password"
            className="font-medium text-zinc-900 hover:text-zinc-700 dark:text-zinc-100 dark:hover:text-white"
          >
            忘记密码？
          </Link>
        ) : null}
        <div>
          {mode === 'login' ? '没有账号？' : '已有账号？'}
          <button
            type="button"
            onClick={() => handleModeChange(mode === 'login' ? 'signup' : 'login')}
            className="ml-1 font-medium text-zinc-900 hover:text-zinc-700 dark:text-zinc-100 dark:hover:text-white"
          >
            {mode === 'login' ? '去注册' : '去登录'}
          </button>
          <span className="mx-2">·</span>
          <Link
            href={safeNext}
            className="font-medium text-zinc-900 hover:text-zinc-700 dark:text-zinc-100 dark:hover:text-white"
          >
            返回{safeNext === '/' ? '首页' : '目标页面'}
          </Link>
        </div>
      </div>
    </div>
  )
}
