'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ModuleInfo } from '@/utils/modules'

type PermissionDefault = {
  module_key: string
  role: string
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
  roles: string[]
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

  const [selectedRole, setSelectedRole] = useState<string>('admin')
  const [newRole, setNewRole] = useState('')

  const [selectedUser, setSelectedUser] = useState<string>('')

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
          if (body.roles.length > 0) {
            setSelectedRole(body.roles[0])
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

  const handleSaveDefault = async (moduleKey: string, role: string) => {
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

  const handleSaveOverride = async (moduleKey: string) => {
    if (!selectedUser) return

    const key = `${selectedUser}:${moduleKey}`
    const current = overrideMap.get(key)
    const payload = {
      scope: 'user' as const,
      moduleKey,
      userId: selectedUser,
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

      setSuccess('用户权限已更新。')
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSavingKey(null)
    }
  }

  const handleSaveOverrideBatch = async () => {
    if (!selectedUser || !data) return

    const modules = data.modules.map((module) => {
      const key = `${selectedUser}:${module.key}`
      const current = overrideMap.get(key)

      return {
        moduleKey: module.key,
        canRead: current?.can_read ?? false,
        canWrite: current?.can_write ?? false,
      }
    })

    setSavingKey(`user-batch:${selectedUser}`)
    setSuccess(null)
    setError(null)

    try {
      const response = await fetch('/admin/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'user-batch', userId: selectedUser, modules }),
      })
      const result = (await response.json()) as { message?: string }

      if (!response.ok) {
        throw new Error(result.message ?? '保存失败')
      }

      setSuccess('用户权限已批量更新。')
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSavingKey(null)
    }
  }

  const handleCreateRole = async () => {
    if (!newRole.trim()) return

    setSavingKey(`role:create:${newRole}`)
    setError(null)
    setSuccess(null)
    try {
      const response = await fetch('/admin/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'role', role: newRole.trim(), action: 'create' }),
      })
      const result = (await response.json()) as { message?: string }

      if (!response.ok) {
        throw new Error(result.message ?? '新增角色失败')
      }

      setSuccess('角色已新增。')
      setData((prev) =>
        prev
          ? {
              ...prev,
              roles: Array.from(new Set([...prev.roles, newRole.trim()])),
            }
          : prev
      )
      setSelectedRole(newRole.trim())
      setNewRole('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '新增角色失败')
    } finally {
      setSavingKey(null)
    }
  }

  const handleDeleteRole = async () => {
    if (!selectedRole) return

    setSavingKey(`role:delete:${selectedRole}`)
    setError(null)
    setSuccess(null)
    try {
      const response = await fetch('/admin/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'role', role: selectedRole, action: 'delete' }),
      })
      const result = (await response.json()) as { message?: string }

      if (!response.ok) {
        throw new Error(result.message ?? '删除角色失败')
      }

      setSuccess('角色已删除。')
      setData((prev) =>
        prev
          ? {
              ...prev,
              roles: prev.roles.filter((role) => role !== selectedRole),
              defaults: prev.defaults.filter((item) => item.role !== selectedRole),
            }
          : prev
      )
      setSelectedRole('admin')
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除角色失败')
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
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">角色配置</h3>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-xs text-zinc-500">选择角色</p>
              <select
                value={selectedRole}
                onChange={(event) => setSelectedRole(event.target.value)}
                className="mt-2 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
              >
                {data.roles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleDeleteRole}
                  disabled={savingKey === `role:delete:${selectedRole}`}
                  className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:text-zinc-200 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
                >
                  {savingKey === `role:delete:${selectedRole}` ? '删除中...' : '删除角色'}
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-xs text-zinc-500">新增角色</p>
              <div className="mt-2 flex gap-2">
                <input
                  value={newRole}
                  onChange={(event) => setNewRole(event.target.value)}
                  className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                  placeholder="例如: auditor"
                />
                <button
                  type="button"
                  onClick={handleCreateRole}
                  disabled={savingKey === `role:create:${newRole.trim()}`}
                  className="rounded-full bg-zinc-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-zinc-900"
                >
                  新增
                </button>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">角色权限树</h3>
          <div className="mt-3 space-y-4">
            {data.modules.map((module) => {
              const key = `${module.key}:${selectedRole}`
              const current = defaultMap.get(key)

              return (
                <div
                  key={module.key}
                  className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {module.name}
                    </p>
                    <span className="text-xs text-zinc-500">模块</span>
                  </div>
                  <div className="mt-3 flex items-center gap-4 text-xs text-zinc-500">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={current?.can_read ?? false}
                        onChange={(event) => {
                          const next = {
                            module_key: module.key,
                            role: selectedRole,
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
                      读权限
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={current?.can_write ?? false}
                        onChange={(event) => {
                          const next = {
                            module_key: module.key,
                            role: selectedRole,
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
                      写权限
                    </label>
                    <button
                      type="button"
                      onClick={() => handleSaveDefault(module.key, selectedRole)}
                      disabled={savingKey === key}
                      className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:text-zinc-200 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
                    >
                      {savingKey === key ? '保存中...' : '保存'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">用户覆盖权限</h3>
          <div className="mt-3">
            <label className="text-xs text-zinc-500">
              用户
              <select
                value={selectedUser}
                onChange={(event) => setSelectedUser(event.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
              >
                {data.users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.email ?? user.id}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-3">
              <button
                type="button"
                onClick={handleSaveOverrideBatch}
                disabled={savingKey === `user-batch:${selectedUser}`}
                className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:text-zinc-200 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
              >
                {savingKey === `user-batch:${selectedUser}` ? '保存中...' : '保存全部模块'}
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {data.modules.map((module) => {
              const key = `${selectedUser}:${module.key}`
              const current = overrideMap.get(key)

              return (
                <div
                  key={module.key}
                  className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {module.name}
                    </p>
                    <span className="text-xs text-zinc-500">模块</span>
                  </div>
                  <div className="mt-3 flex items-center gap-4 text-xs text-zinc-500">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={current?.can_read ?? false}
                        onChange={(event) => {
                          const next = {
                            user_id: selectedUser,
                            module_key: module.key,
                            can_read: event.target.checked,
                            can_write: current?.can_write ?? false,
                          }
                          overrideMap.set(key, next as PermissionOverride)
                          setData((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  overrides: Array.from(overrideMap.values()),
                                }
                              : prev
                          )
                        }}
                      />
                      读权限
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={current?.can_write ?? false}
                        onChange={(event) => {
                          const next = {
                            user_id: selectedUser,
                            module_key: module.key,
                            can_read: current?.can_read ?? false,
                            can_write: event.target.checked,
                          }
                          overrideMap.set(key, next as PermissionOverride)
                          setData((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  overrides: Array.from(overrideMap.values()),
                                }
                              : prev
                          )
                        }}
                      />
                      写权限
                    </label>
                    <button
                      type="button"
                      onClick={() => handleSaveOverride(module.key)}
                      disabled={savingKey === key}
                      className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:text-zinc-200 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
                    >
                      {savingKey === key ? '保存中...' : '保存'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
