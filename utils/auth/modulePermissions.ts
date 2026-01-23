import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getUserRole } from './roles'
import { MODULES, type ModuleKey } from '@/utils/modules'

type PermissionRow = {
  module_key: ModuleKey
  can_read: boolean
  can_write: boolean
}

type ModulePermission = {
  canRead: boolean
  canWrite: boolean
}

export async function resolveModulePermissions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  role: string,
  moduleKey: ModuleKey
) {
  const { data: overrides } = await supabase
    .from('user_module_permissions')
    .select('module_key,can_read,can_write')
    .eq('user_id', userId)
    .eq('module_key', moduleKey)
    .maybeSingle<PermissionRow>()

  if (overrides) {
    return { canRead: overrides.can_read, canWrite: overrides.can_write }
  }

  const { data: defaults } = await supabase
    .from('module_permission_defaults')
    .select('module_key,can_read,can_write')
    .eq('module_key', moduleKey)
    .eq('role', role)
    .maybeSingle<PermissionRow>()

  return {
    canRead: defaults?.can_read ?? false,
    canWrite: defaults?.can_write ?? false,
  }
}

export async function getModulePermissions(moduleKey: ModuleKey, redirectTo = '/login') {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(redirectTo)
  }

  const role = getUserRole(user)

  return {
    supabase,
    user,
    role,
    permissions: await resolveModulePermissions(supabase, user.id, role, moduleKey),
  }
}

export async function requireModuleAccess(moduleKey: ModuleKey, redirectTo = '/login') {
  const { supabase, user, role, permissions } = await getModulePermissions(moduleKey, redirectTo)

  if (!permissions.canRead) {
    redirect('/unauthorized')
  }

  return { supabase, user, role, permissions }
}

export async function requireModuleWriteAccess(moduleKey: ModuleKey, redirectTo = '/login') {
  const { supabase, user, role, permissions } = await getModulePermissions(moduleKey, redirectTo)

  if (!permissions.canRead) {
    redirect('/unauthorized')
  }

  if (!permissions.canWrite) {
    redirect('/unauthorized')
  }

  return { supabase, user, role, permissions }
}

export async function getAccessibleModules() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { user: null, role: 'user', modules: [] as Array<ModulePermission & { key: ModuleKey }> }
  }

  const role = getUserRole(user)
  const moduleKeys = MODULES.map((module) => module.key)

  const { data: overrides } = await supabase
    .from('user_module_permissions')
    .select('module_key,can_read,can_write')
    .eq('user_id', user.id)
    .in('module_key', moduleKeys)

  const { data: defaults } = await supabase
    .from('module_permission_defaults')
    .select('module_key,can_read,can_write')
    .eq('role', role)
    .in('module_key', moduleKeys)

  const overrideMap = new Map(
    (overrides ?? []).map((row) => [row.module_key as ModuleKey, row])
  )
  const defaultMap = new Map(
    (defaults ?? []).map((row) => [row.module_key as ModuleKey, row])
  )

  const modules = moduleKeys.map((key) => {
    const override = overrideMap.get(key)
    const fallback = defaultMap.get(key)

    return {
      key,
      canRead: override?.can_read ?? fallback?.can_read ?? false,
      canWrite: override?.can_write ?? fallback?.can_write ?? false,
    }
  })

  return { supabase, user, role, modules }
}
