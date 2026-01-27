type PromptOption = {
  key: string
  label: string
}

type RawPromptOption = {
  key?: unknown
  label?: unknown
}

export function getLangfusePromptOptions(): PromptOption[] {
  const raw = process.env.LANGFUSE_PROMPT_OPTIONS
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw) as Array<string | RawPromptOption>
    if (!Array.isArray(parsed)) return []

    return parsed
      .map((item) => {
        if (typeof item === 'string') {
          return { key: item, label: item }
        }

        if (item && typeof item === 'object') {
          const key = typeof item.key === 'string' ? item.key : ''
          const label = typeof item.label === 'string' ? item.label : key
          return { key, label }
        }

        return { key: '', label: '' }
      })
      .filter((item) => item.key)
  } catch {
    return []
  }
}

function parsePromptList(payload: Record<string, unknown>): PromptOption[] {
  const list = Array.isArray(payload.data)
    ? payload.data
    : Array.isArray(payload.prompts)
      ? payload.prompts
      : []

  return list
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return { key: '', label: '' }
      }
      const record = item as Record<string, unknown>
      const key =
        (typeof record.name === 'string' && record.name) ||
        (typeof record.promptName === 'string' && record.promptName) ||
        (typeof record.key === 'string' && record.key) ||
        ''
      const label =
        (typeof record.label === 'string' && record.label) ||
        (typeof record.title === 'string' && record.title) ||
        key

      return { key, label }
    })
    .filter((item) => item.key)
}

export async function fetchLangfusePromptOptions(): Promise<PromptOption[]> {
  const host = process.env.LANGFUSE_HOST
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY
  const secretKey = process.env.LANGFUSE_SECRET_KEY

  if (!host || !publicKey || !secretKey) return []

  try {
    const auth = Buffer.from(`${publicKey}:${secretKey}`).toString('base64')
    const response = await fetch(`${host}/api/public/v2/prompts?limit=100&page=1`, {
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    if (!response.ok) return []

    const data = (await response.json()) as Record<string, unknown>
    const items = parsePromptList(data)

    const meta = data.meta as Record<string, unknown> | undefined
    const totalPages = typeof meta?.totalPages === 'number' ? meta.totalPages : 1

    if (totalPages <= 1) {
      return items
    }

    const results = [...items]

    for (let page = 2; page <= totalPages; page += 1) {
      const pageResponse = await fetch(`${host}/api/public/v2/prompts?limit=100&page=${page}`,
        {
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        }
      )

      if (!pageResponse.ok) break
      const pageData = (await pageResponse.json()) as Record<string, unknown>
      results.push(...parsePromptList(pageData))
    }

    return results
  } catch {
    return []
  }
}
