import { Suspense } from 'react'
import AuthForm from '@/features/auth/AuthForm'

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-sm text-zinc-500">加载中...</div>}>
      <AuthForm />
    </Suspense>
  )
}
