# 技术栈 (Tech Stack)

## 架构概览

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│   Next.js   │────▶│   NestJS    │────▶│  PostgreSQL  │
│  (Frontend) │     │  (Backend)  │     │   (Prisma)   │
└─────────────┘     └──────┬──────┘     └──────────────┘
                           │
                    ┌──────┴──────┐
                    │    Redis    │
                    │  + BullMQ   │
                    └─────────────┘
```

---

## Backend

| 技术 | 用途 |
|------|------|
| **NestJS** | 后端框架，模块化架构，依赖注入 |
| **Prisma** | ORM，Schema 管理，数据库迁移 |
| **PostgreSQL** | 主数据库，全文搜索（tsvector） |
| **Redis** | 缓存、Session、分布式锁 |
| **BullMQ** | 异步任务队列（导出、翻译、汇率更新、通知） |
| **Swagger** | API 文档自动生成（`@nestjs/swagger`） |
| **JWT** | 无状态认证，Bearer Token |
| **Docker** | 后端容器化 |

### 后端约定

- 模块按业务域划分：`auth`、`project`、`procurement`、`warehouse`、`finance` 等
- Prisma Schema 为数据模型唯一来源
- 所有写操作通过 Service 层，自动触发 audit_log
- RBAC 使用 NestJS Guard + 自定义 `PermissionsGuard`
- API 统一返回 `{ success, data, message }`，见 [04-api.md](./04-api.md)
- 异步任务（Excel 导出、自动翻译）通过 BullMQ 处理
- **字符编码**：全栈 UTF-8，见 [00-project.md](./00-project.md#字符编码utf-8)

---

## 字符编码

| 组件 | 约定 |
|------|------|
| Node.js / NestJS | 内部 Unicode；HTTP JSON 默认 UTF-8 |
| Prisma / PostgreSQL | 库 `UTF8`；连接 `client_encoding=UTF8` |
| Next.js | 源文件 UTF-8；`next/font` 使用支持拉丁扩展的字体 |
| PowerShell 脚本 | `[Console]::OutputEncoding`、请求体 `UTF8.GetBytes` |
| CSV / 导出 | `Content-Type: text/csv; charset=utf-8` |

---

## Frontend

| 技术 | 用途 |
|------|------|
| **Next.js** | React 框架，App Router，SSR/SSG |
| **React** | UI 库 |
| **TypeScript** | 全栈类型安全 |
| **TailwindCSS** | 原子化 CSS |
| **Shadcn UI** | 组件库（基于 Radix UI） |
| **React Query** | 服务端状态管理、缓存、请求 |
| **Zustand** | 客户端状态（用户信息、UI 状态） |

### 前端约定

- App Router 目录结构：`app/[locale]/...`
- i18n：Next.js 国际化，支持 `zh` / `fr` / `en`
- API 调用统一通过 React Query hooks
- 权限控制：根据用户 permissions 动态渲染菜单与按钮
- 列表页统一封装：分页、搜索、筛选、Excel 导出
- UI 设计：Graphite Gray + Primary Blue，Card 风格，详见 [02-ui.md](./02-ui.md)
- 布局：Sidebar + Top Search + Command Palette（`Ctrl+K`）
- 深色模式：`next-themes`，Desktop First 响应式

---

## Deployment

| 技术 | 用途 |
|------|------|
| **Ubuntu** | 生产服务器操作系统 |
| **Docker Compose** | 多容器编排（API、Web、PostgreSQL、Redis、Nginx） |
| **Nginx** | 反向代理、SSL 终止、静态资源 |

### 服务编排

```yaml
services:
  db:       # PostgreSQL 16（UTF-8）
  redis:    # Redis 7
  api:      # NestJS（apps/api/Dockerfile）
  web:      # Next.js（apps/web/Dockerfile）
  nginx:    # 反向代理（生产可选）
```

本地全栈启动：

```bash
docker compose up -d --build
# Web: http://localhost:3000  API: http://localhost:3001/api/v1/health
```

---

## CI

| 技术 | 用途 |
|------|------|
| **GitHub Actions** | 持续集成与部署 |

### CI 流水线（草案）

合并前须满足 [06-testing.md](./06-testing.md) 功能验收清单：

1. Lint（ESLint）— 零 error
2. TypeScript（`tsc --noEmit`）— 零错误
3. 单元测试（Vitest）— 全部通过
4. 构建（Backend + Frontend）— 成功
5. E2E 测试（Playwright）— 全部通过
6. Prisma Migration — staging 环境验证
7. Docker 镜像构建与推送
8. 部署到 Ubuntu 服务器

---

## Testing

| 技术 | 范围 |
|------|------|
| **Vitest** | 单元测试、集成测试（Backend Service、Frontend 工具函数） |
| **Playwright** | E2E 测试（登录、采购审批、导出等关键流程） |

---

## 目录结构（草案）

```
OverBuild/
├── apps/
│   ├── api/          # NestJS 后端
│   └── web/          # Next.js 前端
├── packages/
│   └── shared/       # 共享类型与工具（可选）
├── prisma/
│   └── schema.prisma
├── docker-compose.yml
├── .github/
│   └── workflows/
└── docs/
```
