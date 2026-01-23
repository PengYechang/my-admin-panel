import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getUserRole, type Role } from './roles'

type RequireUserOptions = {
  redirectTo?: string
}

type RequireRoleOptions = {
  redirectTo?: string
}

export async function requireUser(options: RequireUserOptions = {}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(options.redirectTo ?? '/login')
  }

  const role = getUserRole(user)
  return { supabase, user, role }
}

export async function requireRole(
  allowedRoles: Role[],
  options: RequireRoleOptions = {}
) {
  const result = await requireUser({ redirectTo: options.redirectTo ?? '/login' })

  if (!allowedRoles.includes(result.role)) {
    redirect('/unauthorized')
  }

  return result
}
