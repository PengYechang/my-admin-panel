import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getUserRole } from '@/utils/auth/roles'
import { resolveModulePermissions } from '@/utils/auth/modulePermissions'

type ScenarioPayload = {
  id?: string
  name?: string
  description?: string | null
  promptKey?: string
  config?: Record<string, unknown> | null
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
  const { data, error: listError } = await adminClient
    .from('ai_chat_scenarios')
    .select('id,name,description,prompt_key,config,created_at')
    .order('created_at', { ascending: true })

  if (listError) {
    return NextResponse.json({ message: listError.message }, { status: 500 })
  }

  return NextResponse.json({ scenarios: data ?? [] })
}

export async function POST(request: Request) {
  const { error } = await requireAdmin('write')
  if (error) return error

  const body = (await request.json()) as ScenarioPayload
  const name = body.name?.trim()
  const promptKey = body.promptKey?.trim()

  if (!name || !promptKey) {
    return NextResponse.json({ message: 'Missing name or promptKey' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const { error: insertError } = await adminClient.from('ai_chat_scenarios').insert({
    name,
    description: body.description ?? null,
    prompt_key: promptKey,
    config: body.config ?? null,
  })

  if (insertError) {
    return NextResponse.json({ message: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function PUT(request: Request) {
  const { error } = await requireAdmin('write')
  if (error) return error

  const body = (await request.json()) as ScenarioPayload
  if (!body.id) {
    return NextResponse.json({ message: 'Missing id' }, { status: 400 })
  }

  const name = body.name?.trim()
  const promptKey = body.promptKey?.trim()

  if (!name || !promptKey) {
    return NextResponse.json({ message: 'Missing name or promptKey' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const { error: updateError } = await adminClient
    .from('ai_chat_scenarios')
    .update({
      name,
      description: body.description ?? null,
      prompt_key: promptKey,
      config: body.config ?? null,
    })
    .eq('id', body.id)

  if (updateError) {
    return NextResponse.json({ message: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(request: Request) {
  const { error } = await requireAdmin('write')
  if (error) return error

  const body = (await request.json()) as ScenarioPayload
  if (!body.id) {
    return NextResponse.json({ message: 'Missing id' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const { error: deleteError } = await adminClient
    .from('ai_chat_scenarios')
    .delete()
    .eq('id', body.id)

  if (deleteError) {
    return NextResponse.json({ message: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
