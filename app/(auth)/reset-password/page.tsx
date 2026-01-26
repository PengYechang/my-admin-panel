import { Suspense } from 'react'
import ResetPasswordForm from '@/features/auth/ResetPasswordForm'

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="text-sm text-zinc-500">加载中...</div>}>
      <ResetPasswordForm />
    </Suspense>
  )
}
