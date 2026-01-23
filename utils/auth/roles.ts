import type { User } from '@supabase/supabase-js'

export type Role = 'admin' | 'editor' | 'user'

export function getUserRole(user?: User | null): Role {
  const role = user?.app_metadata?.role ?? user?.user_metadata?.role
  if (role === 'admin' || role === 'editor') return role
  return 'user'
}
