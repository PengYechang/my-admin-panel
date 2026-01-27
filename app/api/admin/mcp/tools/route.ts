import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getUserRole } from '@/utils/auth/roles'
import { resolveModulePermissions } from '@/utils/auth/modulePermissions'
import { getMcpServerRegistryInfo } from '@/utils/mcp/registry'
import { listMcpTools } from '@/utils/mcp/client'

const DEFAULT_TOOL_TIMEOUT_MS = 8000

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

export async function GET(request: Request) {
  const { error } = await requireAdmin()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const serverName = searchParams.get('serverName')

  if (!serverName) {
    return NextResponse.json({ message: 'Missing serverName' }, { status: 400 })
  }

  const registry = getMcpServerRegistryInfo()
  if (registry.error) {
    return NextResponse.json({ message: registry.error }, { status: 400 })
  }

  const server = registry.servers.find((item) => item.name === serverName)
  if (!server) {
    return NextResponse.json({ message: 'MCP server not found' }, { status: 404 })
  }

  try {
    const tools = await listMcpTools(server, DEFAULT_TOOL_TIMEOUT_MS)

    return NextResponse.json({
      server: { name: server.name, url: server.url },
      tools,
    })
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'MCP tools/list failed' },
      { status: 502 }
    )
  }
}
