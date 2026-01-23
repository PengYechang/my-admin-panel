import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getUserRole, type Role } from '@/utils/auth/roles'
import { resolveModulePermissions } from '@/utils/auth/modulePermissions'

type RequestBody = {
  userId?: string
  email?: string
  role?: Role
}

type ListedUser = {
  id: string
  email: string | null
  app_metadata?: { role?: string }
  user_metadata?: { role?: string }
}

const ALLOWED_ROLES: Role[] = ['admin', 'editor', 'user']

async function findUserByEmail(adminClient: ReturnType<typeof createAdminClient>, email: string) {
  let page = 1
  const perPage = 200

  while (page <= 5) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage })
    if (error) {
      return { user: null, error: error.message }
    }

    const user = (data.users as ListedUser[]).find(
      (item) => item.email?.toLowerCase() === email.toLowerCase()
    )

    if (user) {
      return { user, error: null }
    }

    if (data.users.length < perPage) break
    page += 1
  }

  return { user: null, error: 'User not found' }
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

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as RequestBody
  const { userId, email, role } = body

  if (!role || !ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ message: 'Invalid role' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const requesterRole = getUserRole(user)
  const bootstrapEmail = process.env.SUPABASE_BOOTSTRAP_ADMIN_EMAIL
  const isBootstrapUser =
    !!bootstrapEmail && !!user.email && bootstrapEmail.toLowerCase() === user.email.toLowerCase()

  if (requesterRole !== 'admin') {
    const { hasAdmin, error } = await hasAdminUser(adminClient)
    if (error) {
      return NextResponse.json({ message: error }, { status: 500 })
    }

    if (!isBootstrapUser || hasAdmin) {
      return NextResponse.json({ message: 'Admin already exists' }, { status: 403 })
    }
  }

  if (requesterRole === 'admin') {
    const permissions = await resolveModulePermissions(supabase, user.id, requesterRole, 'admin')
    if (!permissions.canWrite) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }
  }

  let targetUserId = userId

  if (!targetUserId && email) {
    const { user: foundUser, error } = await findUserByEmail(adminClient, email)
    if (error || !foundUser) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 })
    }
    targetUserId = foundUser.id
  }

  if (!targetUserId && isBootstrapUser) {
    targetUserId = user.id
  }

  if (isBootstrapUser && targetUserId !== user.id) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }

  if (!targetUserId) {
    return NextResponse.json({ message: 'Missing userId or email' }, { status: 400 })
  }

  const { data: existing, error: getError } = await adminClient.auth.admin.getUserById(
    targetUserId
  )

  if (getError || !existing.user) {
    return NextResponse.json({ message: getError?.message ?? 'User not found' }, { status: 404 })
  }

  const mergedAppMetadata = {
    ...(existing.user.app_metadata ?? {}),
    role,
  }

  const { data, error } = await adminClient.auth.admin.updateUserById(targetUserId, {
    app_metadata: mergedAppMetadata,
  })

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json({
    user: {
      id: data.user.id,
      email: data.user.email,
      role: data.user.app_metadata?.role ?? 'user',
    },
  })
}
