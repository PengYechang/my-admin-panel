// middleware.ts
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // 中间件里的 getAll
        getAll() {
          return request.cookies.getAll()
        },
        // 中间件里的 setAll
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          
          // 这步很关键：把更新后的 Cookie 同时写入 Response
          // 这样浏览器才能收到最新的 Auth 状态
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 刷新 Session (这步很重要，它会检查通过 Cookie 里的 Token 是否过期)
  await supabase.auth.getUser()

  return response
}

export const config = {
  // 匹配所有路径，除了静态资源
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}