# 登录与权限模块 (auth)

> 登录认证、RBAC 权限。操作审计见 [audit-log.md](./audit-log.md)。

## 功能

| 功能 | 说明 |
|------|------|
| 登录 | 用户名 + 密码，返回 JWT |
| 登出 | 注销 Token（Redis 黑名单） |
| 刷新 Token | Refresh Token 换取新 Access Token |
| 当前用户 | 获取用户信息、角色、权限列表 |
| 用户管理 | 管理员 CRUD 用户 |
| 角色管理 | 管理员 CRUD 角色 |
| 权限管理 | 管理员分配角色权限 |
| 用户-角色绑定 | 为用户分配角色，可限定项目范围 |

## 预置角色

管理员、老板、项目经理（项目主管）、采购、仓库管理员、财务、工程师、翻译

## 字段

### 用户 (users)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | uuid | — | 主键 |
| `username` | string | 是 | 登录名，唯一 |
| `passwordHash` | string | 是 | bcrypt 加密 |
| `name` | string | 是 | 显示名称 |
| `email` | string | 否 | 邮箱 |
| `phone` | string | 否 | 电话 |
| `locale` | enum | 否 | `zh` \| `fr` \| `en`，界面语言 |
| `status` | enum | — | `active` \| `inactive` |
| `createdAt` | datetime | — | 创建时间 |
| `updatedAt` | datetime | — | 更新时间 |

### 角色 (roles)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | uuid | — | 主键 |
| `code` | string | 是 | 角色编码，唯一，如 `project_manager` |
| `name` | string | 是 | 角色名称 |
| `description` | string | 否 | 描述 |

### 权限 (permissions)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | uuid | — | 主键 |
| `code` | string | 是 | 格式 `{module}.{resource}.{action}` |
| `name` | string | 是 | 权限名称 |
| `module` | string | 是 | 所属模块 |

示例：`material.create`、`finance.payment.approve`、`project.read`

### 用户角色 (user_roles)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `userId` | uuid | 是 | 用户 |
| `roleId` | uuid | 是 | 角色 |
| `projectId` | uuid | 否 | 项目范围（空 = 全局） |

## 业务规则

- 系统必须采用 **RBAC**，所有 API 与 UI 须校验权限
- 密码不可明文存储，不可返回给前端
- 登录失败超过 5 次锁定 15 分钟
- 权限变更记入 audit_log
- Token 过期：Access Token 2h，Refresh Token 7d

## API

基础路径：`/api/v1/auth`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/auth/login` | 登录 |
| POST | `/auth/logout` | 登出 |
| POST | `/auth/refresh` | 刷新 Token |
| GET | `/auth/me` | 当前用户信息与权限 |

### 用户管理 `/api/v1/users`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/users` | 用户列表 |
| GET | `/users/:id` | 用户详情 |
| POST | `/users` | 创建用户 |
| PUT | `/users/:id` | 编辑用户 |
| DELETE | `/users/:id` | 停用用户 |
| PUT | `/users/:id/roles` | 分配角色 |
| GET | `/users/export` | Excel 导出 |

### 角色管理 `/api/v1/roles`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/roles` | 角色列表 |
| POST | `/roles` | 创建角色 |
| PUT | `/roles/:id` | 编辑角色 |
| PUT | `/roles/:id/permissions` | 分配权限 |

## 权限

| 操作 | 管理员 | 其他角色 |
|------|--------|----------|
| 用户 CRUD | ✓ | — |
| 角色/权限管理 | ✓ | — |
| 登录/登出/查看自己 | ✓ | ✓ |

> 操作日志见 [audit-log.md](./audit-log.md)

## 操作日志

- 用户创建/编辑/停用
- 角色与权限变更
- 登录/登出
- 登录失败（安全审计）

## 验收标准

| # | 验收项 | 通过条件 |
|---|--------|----------|
| 1 | 登录成功 | 返回 JWT，`/auth/me` 可获取权限 |
| 2 | 登出成功 | Token 失效，后续请求 401 |
| 3 | RBAC 生效 | 无权限 API 返回 403 |
| 4 | 用户 CRUD | 管理员可管理用户，密码不明文 |
| 5 | 角色分配 | 用户角色绑定后权限即时生效 |
| 6 | 项目范围 | 项目经理仅可访问所辖项目数据 |
| 7 | 登录限流 | 连续失败 5 次锁定 |
| 8 | 日志正确 | 登录、权限变更有 audit_log |
| 9 | 测试全部通过 | 满足 [06-testing.md](../06-testing.md) 验收 13 项 |
