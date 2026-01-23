import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getUserRole, type Role } from '@/utils/auth/roles'
import { MODULES, type ModuleKey } from '@/utils/modules'
import { resolveModulePermissions } from '@/utils/auth/modulePermissions'

type PermissionDefault = {
  module_key: ModuleKey
  role: Role
  can_read: boolean
  can_write: boolean
}

type PermissionOverride = {
  user_id: string
  module_key: ModuleKey
  can_read: boolean
  can_write: boolean
}

type RequestBody = {
  scope: 'default' | 'user'
  moduleKey: ModuleKey
  role?: Role
  userId?: string
  canRead: boolean
  canWrite: boolean
}

const ROLES: Role[] = ['admin', 'editor', 'user']

const DEFAULT_PERMISSIONS: Array<PermissionDefault> = [
  { module_key: 'admin', role: 'admin', can_read: true, can_write: true },
  { module_key: 'admin', role: 'editor', can_read: false, can_write: false },
  { module_key: 'admin', role: 'user', can_read: false, can_write: false },
  { module_key: 'blog', role: 'admin', can_read: true, can_write: true },
  { module_key: 'blog', role: 'editor', can_read: true, can_write: true },
  { module_key: 'blog', role: 'user', can_read: true, can_write: false },
  { module_key: 'memo', role: 'admin', can_read: true, can_write: true },
  { module_key: 'memo', role: 'editor', can_read: true, can_write: true },
  { module_key: 'memo', role: 'user', can_read: true, can_write: true },
]

async function ensureDefaultPermissions(adminClient: ReturnType<typeof createAdminClient>) {
  const { error } = await adminClient
    .from('module_permission_defaults')
    .upsert(DEFAULT_PERMISSIONS, { onConflict: 'module_key,role' })

  if (error) {
    throw new Error(error.message)
  }
}

async function requireAdmin(required: 'read' | 'write') {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ message: 'Unauthorized' }, { status: 401 }) }
  }

  const role = getUserRole(user)
  if (role !== 'admin') {
    return { error: NextResponse.json({ message: 'Forbidden' }, { status: 403 }) }
  }

  const permissions = await resolveModulePermissions(supabase, user.id, role, 'admin')
  if (required === 'read' && !permissions.canRead) {
    return { error: NextResponse.json({ message: 'Forbidden' }, { status: 403 }) }
  }
  if (required === 'write' && !permissions.canWrite) {
    return { error: NextResponse.json({ message: 'Forbidden' }, { status: 403 }) }
  }

  return { user }
}

export async function GET() {
  const { error } = await requireAdmin('read')
  if (error) return error

  const adminClient = createAdminClient()

  try {
    await ensureDefaultPermissions(adminClient)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Default init failed'
    return NextResponse.json({ message }, { status: 500 })
  }

  const [{ data: defaults, error: defaultsError }, { data: overrides, error: overridesError }, {
    data: users,
    error: usersError,
  }] = await Promise.all([
    adminClient
      .from('module_permission_defaults')
      .select('module_key,role,can_read,can_write'),
    adminClient
      .from('user_module_permissions')
      .select('user_id,module_key,can_read,can_write'),
    adminClient.auth.admin.listUsers(),
  ])

  if (defaultsError || overridesError || usersError) {
    return NextResponse.json(
      { message: defaultsError?.message ?? overridesError?.message ?? usersError?.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    modules: MODULES,
    roles: ROLES,
    defaults: (defaults ?? []) as PermissionDefault[],
    overrides: (overrides ?? []) as PermissionOverride[],
    users: users.users.map((item) => ({ id: item.id, email: item.email })),
  })
}

export async function POST(request: Request) {
  const { error } = await requireAdmin('write')
  if (error) return error

  const body = (await request.json()) as RequestBody
  const { scope, moduleKey, role, userId, canRead, canWrite } = body

  if (!moduleKey) {
    return NextResponse.json({ message: 'Missing moduleKey' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  if (scope === 'default') {
    if (!role || !ROLES.includes(role)) {
      return NextResponse.json({ message: 'Missing role' }, { status: 400 })
    }

    const { error: upsertError } = await adminClient.from('module_permission_defaults').upsert({
      module_key: moduleKey,
      role,
      can_read: canRead,
      can_write: canWrite,
    })

    if (upsertError) {
      return NextResponse.json({ message: upsertError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  }

  if (!userId) {
    return NextResponse.json({ message: 'Missing userId' }, { status: 400 })
  }

  const { error: userUpsertError } = await adminClient.from('user_module_permissions').upsert({
    user_id: userId,
    module_key: moduleKey,
    can_read: canRead,
    can_write: canWrite,
  })

  if (userUpsertError) {
    return NextResponse.json({ message: userUpsertError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
