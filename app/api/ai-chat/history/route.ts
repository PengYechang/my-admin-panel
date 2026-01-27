import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const scenarioId = searchParams.get('scenarioId')
  const conversationId = searchParams.get('conversationId')

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

  const { data, error } = await supabase
    .from('ai_chat_messages')
    .select('id,role,content,created_at')
    .eq('user_id', user.id)
    .eq('scenario_id', scenarioId)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json({ messages: data ?? [] })
}
