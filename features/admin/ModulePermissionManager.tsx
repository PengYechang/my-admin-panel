'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ModuleInfo } from '@/utils/modules'
import type { Role } from '@/utils/auth/roles'

type PermissionDefault = {
  module_key: string
  role: Role
  can_read: boolean
  can_write: boolean
}

type PermissionOverride = {
  user_id: string
  module_key: string
  can_read: boolean
  can_write: boolean
}

type UserRow = {
  id: string
  email: string | null
}

type PermissionResponse = {
  modules: ModuleInfo[]
  roles: Role[]
  defaults: PermissionDefault[]
  overrides: PermissionOverride[]
  users: UserRow[]
}

export default function ModulePermissionManager() {
  const [data, setData] = useState<PermissionResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [selectedUser, setSelectedUser] = useState<string>('')
  const [selectedModule, setSelectedModule] = useState<string>('blog')
  const [canRead, setCanRead] = useState(true)
  const [canWrite, setCanWrite] = useState(false)

  useEffect(() => {
    let active = true

    const fetchData = async () => {
      setIsLoading(true)
      setError(null)
      setSuccess(null)

      try {
        const response = await fetch('/admin/permissions')
        const body = (await response.json()) as PermissionResponse & { message?: string }

        if (!response.ok) {
          throw new Error(body.message ?? '加载失败')
        }

        if (active) {
          setData(body)
          if (body.users.length > 0) {
            setSelectedUser(body.users[0].id)
          }
          if (body.modules.length > 0) {
            setSelectedModule(body.modules[0].key)
          }
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : '加载失败')
        }
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    fetchData()

    return () => {
      active = false
    }
  }, [])

  const defaultMap = useMemo(() => {
    const map = new Map<string, PermissionDefault>()
    data?.defaults.forEach((item) => {
      map.set(`${item.module_key}:${item.role}`, item)
    })
    return map
  }, [data])

  const overrideMap = useMemo(() => {
    const map = new Map<string, PermissionOverride>()
    data?.overrides.forEach((item) => {
      map.set(`${item.user_id}:${item.module_key}`, item)
    })
    return map
  }, [data])

  const handleSaveDefault = async (moduleKey: string, role: Role) => {
    const key = `${moduleKey}:${role}`
    const current = defaultMap.get(key)
    const payload = {
      scope: 'default' as const,
      moduleKey,
      role,
      canRead: current?.can_read ?? false,
      canWrite: current?.can_write ?? false,
    }

    setSavingKey(key)
    setSuccess(null)
    setError(null)
    try {
      const response = await fetch('/admin/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = (await response.json()) as { message?: string }

      if (!response.ok) {
        throw new Error(result.message ?? '保存失败')
      }

      setSuccess('默认权限已更新。')
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSavingKey(null)
    }
  }

  const handleSaveOverride = async () => {
    if (!selectedUser) return

    const payload = {
      scope: 'user' as const,
      moduleKey: selectedModule,
      userId: selectedUser,
      canRead,
      canWrite,
    }

    setSavingKey(`${selectedUser}:${selectedModule}`)
    setSuccess(null)
    setError(null)

    try {
      const response = await fetch('/admin/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = (await response.json()) as { message?: string }

      if (!response.ok) {
        throw new Error(result.message ?? '保存失败')
      }

      setSuccess('用户权限已更新。')
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSavingKey(null)
    }
  }

  if (isLoading) {
    return (
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">加载权限配置中...</p>
      </section>
    )
  }

  if (error) {
    return (
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
      </section>
    )
  }

  if (!data) {
    return null
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">模块权限配置</h2>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">默认权限与用户覆盖</span>
      </div>

      {success ? (
        <p className="mb-3 text-sm text-emerald-600 dark:text-emerald-400">{success}</p>
      ) : null}

      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">默认权限</h3>
          <div className="mt-3 space-y-4">
            {data.modules.map((module) => (
              <div
                key={module.key}
                className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{module.name}</p>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {data.roles.map((role) => {
                    const key = `${module.key}:${role}`
                    const current = defaultMap.get(key)

                    return (
                      <div
                        key={key}
                        className="rounded-lg border border-zinc-200 p-3 text-xs dark:border-zinc-800"
                      >
                        <p className="text-zinc-500">角色：{role}</p>
                        <div className="mt-2 flex items-center gap-3">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={current?.can_read ?? false}
                              onChange={(event) => {
                                const next = {
                                  module_key: module.key,
                                  role,
                                  can_read: event.target.checked,
                                  can_write: current?.can_write ?? false,
                                }
                                defaultMap.set(key, next as PermissionDefault)
                                setData((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        defaults: Array.from(defaultMap.values()),
                                      }
                                    : prev
                                )
                              }}
                            />
                            读
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={current?.can_write ?? false}
                              onChange={(event) => {
                                const next = {
                                  module_key: module.key,
                                  role,
                                  can_read: current?.can_read ?? false,
                                  can_write: event.target.checked,
                                }
                                defaultMap.set(key, next as PermissionDefault)
                                setData((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        defaults: Array.from(defaultMap.values()),
                                      }
                                    : prev
                                )
                              }}
                            />
                            写
                          </label>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSaveDefault(module.key, role)}
                          disabled={savingKey === key}
                          className="mt-3 inline-flex items-center justify-center rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:text-zinc-200 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
                        >
                          {savingKey === key ? '保存中...' : '保存'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">用户覆盖权限</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="text-xs text-zinc-500">
              用户
              <select
                value={selectedUser}
                onChange={(event) => setSelectedUser(event.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-2 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
              >
                {data.users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.email ?? user.id}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-zinc-500">
              模块
              <select
                value={selectedModule}
                onChange={(event) => setSelectedModule(event.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-2 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
              >
                {data.modules.map((module) => (
                  <option key={module.key} value={module.key}>
                    {module.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs text-zinc-500">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={canRead}
                onChange={(event) => setCanRead(event.target.checked)}
              />
              读
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={canWrite}
                onChange={(event) => setCanWrite(event.target.checked)}
              />
              写
            </label>
            <button
              type="button"
              onClick={handleSaveOverride}
              disabled={savingKey === `${selectedUser}:${selectedModule}`}
              className="inline-flex items-center justify-center rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:text-zinc-200 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
            >
              {savingKey === `${selectedUser}:${selectedModule}` ? '保存中...' : '保存'}
            </button>
          </div>

          <div className="mt-4 space-y-2 text-xs text-zinc-500">
            {data.overrides
              .filter((item) => item.user_id === selectedUser)
              .map((item) => {
                const module = data.modules.find((mod) => mod.key === item.module_key)
                return (
                  <p key={`${item.user_id}:${item.module_key}`}>
                    {module?.name ?? item.module_key}：读 {item.can_read ? '✔' : '✖'} / 写{' '}
                    {item.can_write ? '✔' : '✖'}
                  </p>
                )
              })}
          </div>
        </div>
      </div>
    </section>
  )
}
