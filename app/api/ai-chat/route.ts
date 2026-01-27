import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

const DEFAULT_TEMPERATURE = 0.7

type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

type RequestBody = {
  scenarioId?: string
  conversationId?: string
  userId?: string
  messages?: ChatMessage[]
}

type LangfusePrompt = {
  prompt?: string
  config?: Record<string, unknown>
}

async function getLangfusePrompt(promptKey: string): Promise<LangfusePrompt> {
  const host = process.env.LANGFUSE_HOST
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY
  const secretKey = process.env.LANGFUSE_SECRET_KEY

  if (!host || !publicKey || !secretKey) {
    return { prompt: promptKey }
  }

  try {
    const auth = Buffer.from(`${publicKey}:${secretKey}`).toString('base64')
    const response = await fetch(`${host}/api/public/v2/prompts/${promptKey}`, {
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      return { prompt: promptKey }
    }

    const data = (await response.json()) as Record<string, unknown>
    const prompt = (data.prompt as string | undefined) ?? promptKey
    const config = (data.config as Record<string, unknown> | undefined) ?? undefined

    return { prompt, config }
  } catch {
    return { prompt: promptKey }
  }
}

async function sendToLangfuseTrace(payload: {
  promptKey: string
  scenarioId: string
  userId: string
  model: string
  input: ChatMessage[]
  output: string
  metadata: Record<string, unknown>
}) {
  const host = process.env.LANGFUSE_HOST
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY
  const secretKey = process.env.LANGFUSE_SECRET_KEY

  if (!host || !publicKey || !secretKey) return

  try {
    const auth = Buffer.from(`${publicKey}:${secretKey}`).toString('base64')
    await fetch(`${host}/api/public/ingestion`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        trace: {
          name: payload.promptKey,
          userId: payload.userId,
          metadata: payload.metadata,
        },
        generations: [
          {
            name: payload.promptKey,
            model: payload.model,
            input: payload.input,
            output: payload.output,
          },
        ],
      }),
    })
  } catch {
    // 忽略追踪失败
  }
}

async function callOpenAI(messages: ChatMessage[]) {
  const apiKey = process.env.OPENAI_API_KEY
  const baseUrl = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1'
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'

  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY')
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: DEFAULT_TEMPERATURE,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || 'OpenAI request failed')
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }

  return data.choices?.[0]?.message?.content ?? ''
}

export async function POST(request: Request) {
  const body = (await request.json()) as RequestBody
  const { scenarioId, conversationId, userId, messages } = body

  if (!scenarioId || !conversationId || !userId || !messages) {
    return NextResponse.json({ message: 'Missing required fields' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || user.id !== userId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const { data: scenario, error: scenarioError } = await supabase
    .from('ai_chat_scenarios')
    .select('id,prompt_key,config')
    .eq('id', scenarioId)
    .single()

  if (scenarioError || !scenario) {
    return NextResponse.json({ message: 'Scenario not found' }, { status: 404 })
  }

  const { prompt, config } = await getLangfusePrompt(scenario.prompt_key)
  const systemMessage: ChatMessage = {
    role: 'system',
    content: prompt ?? scenario.prompt_key,
  }

  const promptMessages = [systemMessage, ...messages]
  const reply = await callOpenAI(promptMessages)

  const { error: insertError } = await supabase.from('ai_chat_messages').insert([
    {
      user_id: user.id,
      scenario_id: scenarioId,
      conversation_id: conversationId,
      role: 'user',
      content: messages[messages.length - 1]?.content ?? '',
    },
    {
      user_id: user.id,
      scenario_id: scenarioId,
      conversation_id: conversationId,
      role: 'assistant',
      content: reply,
    },
  ])

  if (insertError) {
    return NextResponse.json({ message: insertError.message }, { status: 500 })
  }

  await sendToLangfuseTrace({
    promptKey: scenario.prompt_key,
    scenarioId,
    userId: user.id,
    model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    input: promptMessages,
    output: reply,
    metadata: {
      scenarioId,
      config: config ?? scenario.config ?? null,
    },
  })

  return NextResponse.json({ reply })
}
