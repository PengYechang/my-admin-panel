export type ModuleKey = 'admin' | 'blog' | 'memo' | 'ai-chat'

export type ModuleInfo = {
  key: ModuleKey
  name: string
  description: string
  href: string
}

export const MODULES: ModuleInfo[] = [
  {
    key: 'admin',
    name: '权限管理',
    description: '用户角色与模块权限配置。',
    href: '/admin',
  },
  {
    key: 'ai-chat',
    name: 'AI 聊天',
    description: '多场景对话，绑定 Langfuse Prompt。',
    href: '/ai-chat',
  },
  {
    key: 'blog',
    name: '个人博客',
    description: '文章新增、编辑与发布。',
    href: '/blog',
  },
  {
    key: 'memo',
    name: '备忘录',
    description: '记录待办与碎片灵感。',
    href: '/memo',
  },
]
