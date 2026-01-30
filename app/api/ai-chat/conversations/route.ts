import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

type ConversationSummary = {
  id: string
  title: string
  updatedAt: string
  scenarioId: string
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const scenarioId = searchParams.get('scenarioId')

  if (!scenarioId) {
    return NextResponse.json({ message: 'Missing scenarioId' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ conversations: [] })
  }

  const { data, error } = await supabase
    .from('ai_chat_messages')
    .select('conversation_id,content,role,created_at')
    .eq('user_id', user.id)
    .eq('scenario_id', scenarioId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  const map = new Map<string, ConversationSummary>()
  for (const item of data ?? []) {
    if (map.has(item.conversation_id)) continue
    const title = (item.content ?? '').toString().trim().slice(0, 30) || '新对话'
    map.set(item.conversation_id, {
      id: item.conversation_id,
      title,
      updatedAt: item.created_at,
      scenarioId,
    })
  }

  const conversations = Array.from(map.values()).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  )

  return NextResponse.json({ conversations })
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as { scenarioId?: string; conversationId?: string }
  const { scenarioId, conversationId } = body

  if (!scenarioId || !conversationId) {
    return NextResponse.json({ message: 'Missing scenarioId or conversationId' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase
    .from('ai_chat_messages')
    .delete()
    .eq('user_id', user.id)
    .eq('scenario_id', scenarioId)
    .eq('conversation_id', conversationId)

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
