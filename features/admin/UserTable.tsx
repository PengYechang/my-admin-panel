'use client'

import { useEffect, useState } from 'react'

type UserRow = {
  id: string
  email: string | null
  role: string
  createdAt: string | null
  lastSignInAt: string | null
}

type ResponseBody = {
  users?: UserRow[]
  message?: string
}

export default function UserTable() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const fetchUsers = async () => {
      setIsLoading(true)
      setError(null)
      setFeedback(null)

      try {
        const response = await fetch('/admin/users')
        const data = (await response.json()) as ResponseBody

        if (!response.ok) {
          throw new Error(data.message ?? '加载失败')
        }

        if (active) {
          setUsers(data.users ?? [])
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

    fetchUsers()

    return () => {
      active = false
    }
  }, [])

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">用户列表</h2>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">仅管理员可见</span>
      </div>

      {feedback ? (
        <p className="mb-3 text-sm text-emerald-600 dark:text-emerald-400">{feedback}</p>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">正在加载用户列表...</p>
      ) : error ? (
        <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">暂无用户数据。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-600 dark:text-zinc-300">
            <thead className="text-xs uppercase text-zinc-400">
              <tr>
                <th className="py-2">邮箱</th>
                <th className="py-2">角色</th>
                <th className="py-2">操作</th>
                <th className="py-2">最近登录</th>
                <th className="py-2">创建时间</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="py-3">{user.email ?? '-'}</td>
                  <td className="py-3">
                    <select
                      value={user.role}
                      onChange={(event) => {
                        const role = event.target.value
                        setUsers((prev) =>
                          prev.map((item) => (item.id === user.id ? { ...item, role } : item))
                        )
                      }}
                      className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                    >
                      <option value="admin">admin</option>
                      <option value="editor">editor</option>
                      <option value="user">user</option>
                    </select>
                  </td>
                  <td className="py-3">
                    <button
                      type="button"
                      onClick={async () => {
                        setUpdatingId(user.id)
                        setError(null)
                        setFeedback(null)
                        try {
                          const response = await fetch('/admin/users/role', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userId: user.id, role: user.role }),
                          })
                          const data = (await response.json()) as { message?: string }

                          if (!response.ok) {
                            throw new Error(data.message ?? '更新失败')
                          }

                          setFeedback('角色已更新。')
                        } catch (err) {
                          setError(err instanceof Error ? err.message : '更新失败')
                        } finally {
                          setUpdatingId(null)
                        }
                      }}
                      disabled={updatingId === user.id}
                      className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:text-zinc-200 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
                    >
                      {updatingId === user.id ? '更新中...' : '更新角色'}
                    </button>
                  </td>
                  <td className="py-3">{user.lastSignInAt ?? '-'}</td>
                  <td className="py-3">{user.createdAt ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
