# My Admin Panel

基于 Next.js + Supabase + Vercel 的前端管理系统模板，直接通过 Supabase 读写数据库，无独立后端。

## 运行

```bash
npm install
npm run dev
```

## 项目结构

```
app/
	(auth)/              # 认证相关路由
		login/
		forgot-password/
		reset-password/
	(app)/               # 业务模块路由
		admin/             # 权限管理（admin）
		blog/              # 博客模块
		memo/              # 备忘录模块
	auth/                # Supabase 回调与错误页
	unauthorized/        # 无权限提示
features/
	auth/                # 认证相关组件
  admin/               # 权限管理组件
  blog/                # 博客组件
  memo/                # 备忘录组件
utils/
	auth/                # 角色与权限守卫
	modules.ts           # 模块配置
	supabase/            # Supabase 客户端封装（含 admin client）
```

## 权限体系

角色读取顺序：

1. app_metadata.role
2. user_metadata.role
3. 默认 user

权限守卫位于 [utils/auth/guards.ts](utils/auth/guards.ts) 与 [utils/auth/roles.ts](utils/auth/roles.ts)。

## 博客模块

路径：/blog（由模块权限控制）

依赖表：posts（字段示例：id, title, summary, content, published, published_at, created_at, updated_at, author_id）。

建议：开启 RLS，允许 authenticated 读，admin/editor 写入与更新。

## 备忘录模块

路径：/memo（由模块权限控制）

依赖表：memos（字段示例：id, content, created_at, updated_at, user_id）。

## 模块权限

模块默认权限与用户覆盖权限在 /admin 页面管理（包含 admin 模块）。
默认权限（role 维度）+ 用户覆盖（user 维度）共同决定访问与写入。

博客操作：

- 新增：/blog/new
- 编辑：/blog/[id]/edit

## 新增模块指南

请阅读 [docs/ADDING_MODULE.md](docs/ADDING_MODULE.md)。

## 环境变量

在 .env.local 中配置：

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY

如需服务端安全操作（例如：后台批量管理用户、管理角色、敏感写操作），再追加：

- SUPABASE_SERVICE_ROLE_KEY（仅服务端使用）
- SUPABASE_BOOTSTRAP_ADMIN_EMAIL（首次初始化管理员邮箱）

注意：Service Role 只能放在服务端环境变量中，禁止在客户端组件或公开代码里使用。

## 服务端安全配置（是什么）

本项目默认使用匿名公钥（anon key）直接访问数据库。对于“需要更高权限或更严格保护”的操作，必须使用服务端安全配置，核心包括：

1. 使用 Service Role Key：只在服务端（Route Handler / Server Action / API）调用。
2. 启用 RLS：把读写权限下沉到数据库策略，避免客户端越权。
3. 仅暴露安全接口：客户端永远只调用 anon key 或你封装的安全服务端接口。

详见 [docs/ADDING_MODULE.md](docs/ADDING_MODULE.md) 的“服务端安全配置”章节。

## 权限管理（可视化用户列表）

/admin 页面包含用户列表（需 Service Role Key）。用户数据由服务端路由 /admin/users 提供。

首次初始化管理员：设置 SUPABASE_BOOTSTRAP_ADMIN_EMAIL 后，在 /admin 列表中将该邮箱的角色改为 admin。
