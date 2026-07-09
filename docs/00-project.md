# OverBuild

## 项目目标

建立一套适用于驻外工程项目的综合内部管理平台。

主要解决：

- 项目管理
- 材料采购
- 仓库库存
- 财务
- 合同
- 文档
- 图纸
- 翻译
- 审批
- 项目成本分析

## 支持语言

- 中文
- 法语
- 英语

## 字符编码（UTF-8）

系统**全链路统一 UTF-8**，确保中文、法语（含 é è ç 等变音符号）、英文无障碍显示与存储。

| 层级 | 要求 |
|------|------|
| 数据库 | PostgreSQL `ENCODING 'UTF8'` |
| 连接 | `DATABASE_URL` 含 `client_encoding=UTF8` |
| API | JSON 请求/响应 UTF-8；CSV 导出 `charset=utf-8` |
| 前端 | HTML/JS 源文件 UTF-8；`lang` 按界面语言切换 |
| 源码与脚本 | 仓库文件、SQL、PowerShell 脚本均保存为 UTF-8 |
| 用户录入 | 法文字段使用 `name_fr` 等专用列，与中文并列存储 |

**禁止**：在中文 Windows 下使用未声明编码的 GBK 数据库；通过 PowerShell/curl 写入中文时不指定 UTF-8。

建库、修复损坏文本与验收步骤见 [database.md](./database.md#字符编码utf-8) 与 [06-testing.md](./06-testing.md)。

## 系统约束

| 约束 | 说明 |
|------|------|
| 权限模型 | RBAC（基于角色的访问控制） |
| 操作日志 | 所有操作必须记录日志 |
| 数据导出 | 所有数据必须支持导出 Excel |
| 全文搜索 | 所有页面支持全文搜索 |
| 多币种 | 所有金额支持多币种 |

## 技术栈

| 层 | 技术 |
|----|------|
| 后端 | NestJS、Prisma、PostgreSQL、Redis、BullMQ、Swagger、JWT |
| 前端 | Next.js、React、TypeScript、TailwindCSS、Shadcn UI、React Query、Zustand |
| 部署 | Ubuntu、宝塔面板、Docker Compose |
| CI | GitHub Actions |
| 测试 | Vitest、Playwright |

详见 [07-tech-stack.md](./07-tech-stack.md)。

## 文档索引

| 文档 | 内容 |
|------|------|
| [01-business.md](./01-business.md) | 业务域、用户角色、**业务规则** |
| [02-ui.md](./02-ui.md) | 界面规范、**视觉设计**、布局与组件 |
| [database.md](./database.md) | **数据库设计**（变更必更新） |
| [03-db.md](./03-db.md) | ↳ 重定向至 database.md |
| [04-api.md](./04-api.md) | API 规范、**统一返回/分页/错误码** |
| [05-security.md](./05-security.md) | 安全与权限 |
| [06-testing.md](./06-testing.md) | 测试策略、**功能验收清单** |
| [07-tech-stack.md](./07-tech-stack.md) | **技术栈** |
| [TASKS.md](../TASKS.md) | **实现路线图**（模块顺序 + 任务清单） |

### 模块文档

详见 [modules/README.md](./modules/README.md)（共 15 个模块）。

| 模块 | 文档 |
|------|------|
| 登录权限 | [auth](./modules/auth.md) |
| 项目 | [project](./modules/project.md) |
| 材料 | [material](./modules/material.md) |
| 采购 | [procurement](./modules/procurement.md) |
| 仓库 | [warehouse](./modules/warehouse.md) |
| 合同 | [contract](./modules/contract.md) |
| 财务 | [finance](./modules/finance.md) |
| 文档 | [document](./modules/document.md) |
| 图纸 | [drawing](./modules/drawing.md) |
| 翻译 | [translation](./modules/translation.md) |
| 审批 | [workflow](./modules/workflow.md) |
| Dashboard | [dashboard](./modules/dashboard.md) |
| 通知 | [notification](./modules/notification.md) |
| 系统设置 | [settings](./modules/settings.md) |
| 日志 | [audit-log](./modules/audit-log.md) |
