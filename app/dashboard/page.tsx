import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function Dashboard() {
  const supabase = await createClient() 

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return redirect('/login')
  }

  // 3. 如果登录了，去数据库拿数据
  const { data: todos } = await supabase.from('todos').select()

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">欢迎回来, {user.email}</h1>
      <div className="border p-4 rounded bg-gray-100 dark:bg-gray-800">
        <h2 className="text-xl mb-2">你的待办事项 (来自 Supabase):</h2>
        {todos && todos.length > 0 ? (
            <pre>{JSON.stringify(todos, null, 2)}</pre>
        ) : (
            <p>数据库里没有数据。</p>
        )}
      </div>
    </div>
  )
}