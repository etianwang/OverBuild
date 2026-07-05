# OverBuild — Claude 上下文

## 项目简介

OverBuild 是国内公司海外驻外工程项目的综合内部管理平台。

## 核心模块

项目管理、材料采购、仓库库存、财务、合同、文档、图纸、翻译、审批、项目成本分析

## 技术栈

- 后端：NestJS + Prisma + PostgreSQL + Redis + BullMQ + JWT
- 前端：Next.js + React + TypeScript + TailwindCSS + Shadcn UI + React Query + Zustand
- 部署：Ubuntu + Docker Compose + Nginx
- CI：GitHub Actions
- 测试：Vitest + Playwright

## 语言

中文、法语、英语

## 硬性约束

1. **RBAC** — 所有功能与数据访问必须经过角色权限校验
2. **操作日志** — 所有写操作与导出必须记录 audit_log
3. **Excel 导出** — 所有数据列表支持导出
4. **全文搜索** — 所有页面支持搜索，结果受 RBAC 约束
5. **多币种** — 所有金额字段携带币种信息

## 用户角色

管理员、老板、项目经理、采购、仓库管理员、财务、工程师、翻译

## 文档

详细设计见 `docs/` 目录，**业务规则**见 `docs/01-business.md`，**技术栈**见 `docs/07-tech-stack.md`，**数据库**见 `docs/database.md`，模块说明见 `docs/modules/`。

## 开发原则

- 项目（project_id）是核心数据归属维度
- 先读文档再写代码，保持与 docs 一致
- 最小化改动，遵循现有约定
- 功能完成须通过 `docs/06-testing.md` 验收 13 项
