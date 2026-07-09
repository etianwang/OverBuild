# OverBuild — Agent 指南

## 项目

驻外工程项目综合管理平台。文档位于 `docs/`。

## 技术栈

| 层 | 技术 |
|----|------|
| 后端 | NestJS、Prisma、PostgreSQL、Redis、BullMQ、Swagger、JWT |
| 前端 | Next.js、React、TypeScript、TailwindCSS、Shadcn UI、React Query、Zustand |
| 部署 | Ubuntu、宝塔面板、Docker Compose |
| CI/CD | GitHub Actions |
| 测试 | Vitest、Playwright |

详见 `docs/07-tech-stack.md`。

## 开始任务前

1. 阅读 `docs/` 下**全部**文档（含 `docs/modules/`）
2. 阅读 `AGENTS.md` 与 `TASKS.md`
3. **仅实现文档已描述的功能**，禁止擅自扩展
4. 数据库变更必须更新 `docs/database.md`

## 不可违反的约束

- RBAC 权限模型
- 所有操作记录日志
- 所有数据支持 Excel 导出
- 所有页面支持全文搜索
- 所有金额支持多币种（ISO 4217）

## 多语言

界面与文案支持中文、法语、英语，禁止硬编码用户可见字符串。

## UI 设计

- 风格：Graphite Gray + Primary Blue，Minimal，Card 风格
- 布局：Sidebar Navigation + Top Search + Command Palette（`Ctrl+K`）
- 支持 Dark Mode，Desktop First 响应式
- 详见 `docs/02-ui.md`

## 角色

管理员、老板、项目经理、采购、仓库管理员、财务、工程师、翻译

## 代码规范

- 匹配项目现有风格与目录结构
- 最小化改动范围
- 不为显而易见的行为写冗余注释或测试

## 功能完成验收

每一个功能完成之后，必须满足 `docs/06-testing.md` 中的 **13 项验收清单**：

Build 成功 · Lint 无错误 · TypeScript 无错误 · Swagger 正常 · Migration 正常 · API 可测试 · 单元测试通过 · E2E 通过 · 无 Console Error · 响应式正常 · Dark Mode 正常 · 权限正常 · 日志正常

未全部通过不得视为完成。

## 后端模块结构

每个 NestJS 模块必须包含：Repository、Service、Controller、DTO、Validation、Swagger、Unit Test、E2E Test。

详见 `.cursor/rules/nestjs-module.mdc`。

## 完成前必跑

```bash
npm run lint
npm run build
npm run test
npm run test:e2e
```

验收未通过不得停止。
