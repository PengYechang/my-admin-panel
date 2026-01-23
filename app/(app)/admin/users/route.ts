import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getUserRole } from '@/utils/auth/roles'
import { resolveModulePermissions } from '@/utils/auth/modulePermissions'

type ListedUser = {
  id: string
  email: string | null
  app_metadata?: { role?: string }
  user_metadata?: { role?: string }
}

async function hasAdminUser(adminClient: ReturnType<typeof createAdminClient>) {
  let page = 1
  const perPage = 200

  while (page <= 5) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage })
    if (error) {
      return { hasAdmin: false, error: error.message }
    }

    const hasAdmin = (data.users as ListedUser[]).some(
      (item) => item.app_metadata?.role === 'admin' || item.user_metadata?.role === 'admin'
    )

    if (hasAdmin) {
      return { hasAdmin: true, error: null }
    }

    if (data.users.length < perPage) break
    page += 1
  }

  return { hasAdmin: false, error: null }
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const role = getUserRole(user)
  const bootstrapEmail = process.env.SUPABASE_BOOTSTRAP_ADMIN_EMAIL
  const isBootstrapUser =
    !!bootstrapEmail && !!user.email && bootstrapEmail.toLowerCase() === user.email.toLowerCase()

  if (role !== 'admin') {
    const adminClient = createAdminClient()
    const { hasAdmin, error } = await hasAdminUser(adminClient)
    if (error) {
      return NextResponse.json({ message: error }, { status: 500 })
    }

    if (!isBootstrapUser || hasAdmin) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }
  }

  if (role === 'admin') {
    const permissions = await resolveModulePermissions(supabase, user.id, role, 'admin')
    if (!permissions.canRead) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }
  }

  try {
    const adminClient = createAdminClient()
    const { data, error } = await adminClient.auth.admin.listUsers()

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 })
    }

    const users = data.users.map((item) => ({
      id: item.id,
      email: item.email,
      createdAt: item.created_at,
      lastSignInAt: item.last_sign_in_at,
      role: item.app_metadata?.role ?? item.user_metadata?.role ?? 'user',
    }))

    return NextResponse.json({ users })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error'
    return NextResponse.json({ message }, { status: 500 })
  }
}
