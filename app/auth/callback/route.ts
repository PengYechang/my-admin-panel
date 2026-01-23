// app/auth/callback/route.ts
import { NextResponse } from 'next/server'
// 注意：如果你是 Next.js 15，这里引入你之前改好的 utils/supabase/server
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // 这里的 next 是指验证成功后要跳去哪里，默认跳去首页
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // 验证成功，创建了 Session，重定向到用户想去的页面 (比如 /dashboard)
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // 验证失败，跳回以错误页面
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}