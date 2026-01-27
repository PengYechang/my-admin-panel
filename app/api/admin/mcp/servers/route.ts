import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getUserRole } from '@/utils/auth/roles'
import { resolveModulePermissions } from '@/utils/auth/modulePermissions'
import { getMcpServerRegistryInfo } from '@/utils/mcp/registry'

async function requireAdmin() {
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
  if (!permissions.canRead) {
    return { error: NextResponse.json({ message: 'Forbidden' }, { status: 403 }) }
  }

  return { user }
}

export async function GET() {
  const { error } = await requireAdmin()
  if (error) return error

  const registry = getMcpServerRegistryInfo()
  if (registry.error) {
    return NextResponse.json({ message: registry.error }, { status: 400 })
  }

  const servers = registry.servers.map((server) => ({
    name: server.name,
    url: server.url,
  }))

  return NextResponse.json({ servers })
}
