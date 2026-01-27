# 新增模块指南

本项目为纯前端架构（Next.js + Supabase + Vercel），模块以路由分组 + 功能目录组合的方式组织。

## 1. 约定结构

- 路由分组：app/(app)/<module>/page.tsx
- 功能模块：features/<module>/
- 权限守卫：utils/auth/guards.ts

建议：一个模块对应一个路由目录 + 一个 feature 目录。

## 2. 新增页面路由

以“工单模块”为例：

1. 创建路由文件

app/(app)/tickets/page.tsx

2. 读取权限（示例：管理员与编辑可访问）

```
import { requireRole } from '@/utils/auth/guards'

const { supabase } = await requireRole(['admin', 'editor'], {
  redirectTo: '/login?next=/tickets',
})
```

3. 查询数据（直接 Supabase）

```
const { data, error } = await supabase
  .from('tickets')
  .select('*')
  .order('created_at', { ascending: false })
```

## 3. 新增业务组件

在 features/tickets/ 内放组件或业务逻辑，例如：

- features/tickets/TicketList.tsx
- features/tickets/TicketCard.tsx

在页面中引用：

```
import TicketList from '@/features/tickets/TicketList'
```

## 4. 权限与角色配置

角色来源：

- app_metadata.role（优先）
- user_metadata.role（兜底）

如需新增角色，请在 utils/auth/roles.ts 中扩展 Role 类型与读取逻辑。

## 5. 数据库表结构与 RLS（建议）

在 Supabase 中创建表后，建议开启 RLS 并添加最小权限策略。

示例：posts 表允许登录用户读、admin/editor 写

```
-- 读权限
create policy "posts_read" on public.posts
for select using (auth.role() = 'authenticated');

-- 写权限
create policy "posts_write" on public.posts
for insert with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'editor')
);
```

根据业务需求扩展策略。

## 6. 服务端安全配置（何时需要）

当模块涉及以下场景时，需要服务端安全配置：

- 管理用户角色 / 批量操作用户
- 管理敏感数据（财务、权限、审核）
- 需要绕过 RLS 进行系统级写入

### 6.1 核心原则

- Service Role Key 只能在服务端使用
- 客户端仅使用 anon key
- 重要写操作通过服务端入口封装

### 6.2 建议做法

1. 在 .env.local / Vercel 环境变量中配置：

- SUPABASE_SERVICE_ROLE_KEY

2. 通过 Route Handler / Server Action 调用 Service Role

3. 数据库层仍开启 RLS（可针对服务端使用 bypass 或特定策略）

## 7. 博客模块建议完善

建议 posts 表字段：

- id (uuid)
- title (text)
- summary (text)
- content (text)
- published (boolean)
- published_at (timestamp)
- created_at (timestamp)
- updated_at (timestamp)
- author_id (uuid)

RLS 建议：

- authenticated 可读
- admin/editor 可写
- 仅 author_id = auth.uid() 的用户可更新/删除

## 8. 权限管理可视化用户列表（已内置）

管理员页面通过 /admin/users 路由读取用户列表：

- 仅 admin 角色可访问
- 使用 Service Role Key 查询 Supabase 用户

这类操作必须在服务端执行，避免将 Service Role 暴露给客户端。

## 9. SQL 建表与 RLS 策略（posts 示例）

在 Supabase SQL Editor 执行以下脚本：

```
create extension if not exists "pgcrypto";

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text,
  content text,
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  author_id uuid not null references auth.users(id) on delete cascade
);

create index if not exists posts_created_at_idx on public.posts (created_at desc);
create index if not exists posts_author_id_idx on public.posts (author_id);

alter table public.posts enable row level security;

-- 读：登录用户可读
create policy "posts_read" on public.posts
for select using (auth.role() = 'authenticated');

-- 写：admin/editor 可写
create policy "posts_insert" on public.posts
for insert with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'editor')
);

-- 改：作者本人 或 admin/editor
create policy "posts_update" on public.posts
for update using (
  auth.uid() = author_id
  or (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'editor')
);

-- 删：作者本人 或 admin/editor
create policy "posts_delete" on public.posts
for delete using (
  auth.uid() = author_id
  or (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'editor')
);

-- 可选：自动更新时间戳
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_posts_updated_at on public.posts;
create trigger set_posts_updated_at
before update on public.posts
for each row execute function public.set_updated_at();
```

## 10. SQL（用户资料表 / 角色管理表）

说明：

- profiles：保存用户资料（昵称、头像等）。
- user_roles：用于可视化管理用户角色（可选，若继续使用 app_metadata.role 可忽略）。

```
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'editor', 'user')),
  updated_at timestamptz not null default now()
);

create index if not exists user_roles_role_idx on public.user_roles (role);

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;

-- profiles：用户只可读写自己的资料
create policy "profiles_read_self" on public.profiles
for select using (auth.uid() = id);

create policy "profiles_update_self" on public.profiles
for update using (auth.uid() = id);

create policy "profiles_insert_self" on public.profiles
for insert with check (auth.uid() = id);

-- user_roles：仅 admin 可读写
create policy "user_roles_read_admin" on public.user_roles
for select using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "user_roles_write_admin" on public.user_roles
for insert with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "user_roles_update_admin" on public.user_roles
for update using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "user_roles_delete_admin" on public.user_roles
for delete using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- 可选：自动更新时间戳
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_user_roles_updated_at on public.user_roles;
create trigger set_user_roles_updated_at
before update on public.user_roles
for each row execute function public.set_updated_at();
```

提示：

- 若继续使用 app_metadata.role，则 user_roles 表可不建。
- 可视化用户列表（/admin/users）目前依赖 Supabase Auth 管理接口，不依赖 user_roles 表。

## 11. 设置管理员角色（服务端）

本项目已内置角色设置接口：

- POST /admin/users/role

规则：

- 已是 admin 的用户可修改任意用户角色
- 首次初始化可使用 `SUPABASE_BOOTSTRAP_ADMIN_EMAIL`（仅允许一次）

配置步骤：

1. 在 .env.local / Vercel 增加：

- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_BOOTSTRAP_ADMIN_EMAIL=你的邮箱

2. 登录后访问 /admin 页面，修改目标用户角色为 admin。

注意：Bootstrap 仅用于第一次初始化管理员。

## 12. SQL（备忘录模块）

```
create table if not exists public.memos (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade
);

create index if not exists memos_user_id_idx on public.memos (user_id);

alter table public.memos enable row level security;

create policy "memos_read_self" on public.memos
for select using (auth.uid() = user_id);

create policy "memos_insert_self" on public.memos
for insert with check (auth.uid() = user_id);

create policy "memos_update_self" on public.memos
for update using (auth.uid() = user_id);

create policy "memos_delete_self" on public.memos
for delete using (auth.uid() = user_id);

drop trigger if exists set_memos_updated_at on public.memos;
create trigger set_memos_updated_at
before update on public.memos
for each row execute function public.set_updated_at();
```

## 13. SQL（模块权限表）

```
create table if not exists public.module_permission_defaults (
  module_key text not null,
  role text not null check (role in ('admin', 'editor', 'user')),
  can_read boolean not null default false,
  can_write boolean not null default false,
  primary key (module_key, role)
);

create table if not exists public.user_module_permissions (
  user_id uuid not null references auth.users(id) on delete cascade,
  module_key text not null,
  can_read boolean not null default false,
  can_write boolean not null default false,
  primary key (user_id, module_key)
);

alter table public.module_permission_defaults enable row level security;
alter table public.user_module_permissions enable row level security;

-- 默认权限：所有登录用户可读
create policy "module_defaults_read" on public.module_permission_defaults
for select using (auth.role() = 'authenticated');

-- 默认权限：仅 admin 可写
create policy "module_defaults_write" on public.module_permission_defaults
for insert with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "module_defaults_update" on public.module_permission_defaults
for update using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "module_defaults_delete" on public.module_permission_defaults
for delete using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- 用户覆盖：本人可读
create policy "module_overrides_read_self" on public.user_module_permissions
for select using (auth.uid() = user_id);

-- 用户覆盖：仅 admin 可写
create policy "module_overrides_write_admin" on public.user_module_permissions
for insert with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "module_overrides_update_admin" on public.user_module_permissions
for update using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "module_overrides_delete_admin" on public.user_module_permissions
for delete using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- 初始化默认权限（示例）
insert into public.module_permission_defaults (module_key, role, can_read, can_write)
values
  ('admin', 'admin', true, true),
  ('admin', 'editor', false, false),
  ('admin', 'user', false, false),
  ('ai-chat', 'admin', true, true),
  ('ai-chat', 'editor', true, true),
  ('ai-chat', 'user', true, true),
  ('blog', 'admin', true, true),
  ('blog', 'editor', true, true),
  ('blog', 'user', true, false),
  ('memo', 'admin', true, true),
  ('memo', 'editor', true, true),
  ('memo', 'user', true, true)
on conflict do nothing;
```

## 13. SQL（AI 聊天模块）

```
create table if not exists public.ai_chat_scenarios (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  prompt_key text not null,
  config jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_id uuid not null references public.ai_chat_scenarios(id) on delete cascade,
  conversation_id uuid not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_chat_messages_user_idx on public.ai_chat_messages (user_id);
create index if not exists ai_chat_messages_scenario_idx on public.ai_chat_messages (scenario_id);
create index if not exists ai_chat_messages_conversation_idx on public.ai_chat_messages (conversation_id);

alter table public.ai_chat_scenarios enable row level security;
alter table public.ai_chat_messages enable row level security;

-- 场景：登录用户可读，admin/editor 可写
create policy "ai_chat_scenarios_read" on public.ai_chat_scenarios
for select using (auth.role() = 'authenticated');

create policy "ai_chat_scenarios_write" on public.ai_chat_scenarios
for insert with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'editor'));

create policy "ai_chat_scenarios_update" on public.ai_chat_scenarios
for update using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'editor'));

create policy "ai_chat_scenarios_delete" on public.ai_chat_scenarios
for delete using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'editor'));

-- 消息：仅本人读写
create policy "ai_chat_messages_read" on public.ai_chat_messages
for select using (auth.uid() = user_id);

create policy "ai_chat_messages_insert" on public.ai_chat_messages
for insert with check (auth.uid() = user_id);

create policy "ai_chat_messages_update" on public.ai_chat_messages
for update using (auth.uid() = user_id);

create policy "ai_chat_messages_delete" on public.ai_chat_messages
for delete using (auth.uid() = user_id);
```
