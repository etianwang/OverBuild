# 测试与验收

> 技术栈：Vitest（单元/集成）+ Playwright（E2E）（见 [07-tech-stack.md](./07-tech-stack.md)）

---

## 功能验收 (Acceptance)

**每一个功能完成之后，必须满足以下全部条件方可视为完成：**

| # | 验收项 | 检查方式 | 通过标准 |
|---|--------|----------|----------|
| 1 | **Build 成功** | `npm run build`（api + web） | 零错误，产物正常生成 |
| 2 | **Lint 无错误** | `npm run lint` | ESLint 零 error |
| 3 | **TypeScript 无错误** | `tsc --noEmit` | 零类型错误 |
| 4 | **Swagger 正常** | 访问 `/api/docs` | 新增端点已注册，可在线调试 |
| 5 | **数据库 Migration 正常** | `prisma migrate dev` | Migration 成功，Schema 与代码一致 |
| 6 | **API 可测试** | Swagger / Postman / 集成测试 | 端点可调用，返回 `{ success, data, message }` |
| 7 | **单元测试通过** | `npm run test`（Vitest） | 全部通过，新功能有对应测试 |
| 8 | **E2E 测试通过** | `npm run test:e2e`（Playwright） | 关键流程全绿 |
| 9 | **页面无 Console Error** | 浏览器 DevTools Console | 无 error 级别输出 |
| 10 | **响应式正常** | Desktop / Tablet / Mobile 视口 | 布局无错位、内容可访问 |
| 11 | **Dark Mode 正常** | 切换深色模式 | 色彩、对比度、组件显示正确 |
| 12 | **权限正常** | 各角色登录验证 | RBAC 菜单、按钮、API 权限正确 |
| 13 | **日志正常** | 检查 `audit_logs` | 写操作与导出均有日志记录 |
| 14 | **UTF-8 显示** | 项目列表含中文/法文名称 | 无 `??????`；`PRJ-DEMO-001` 显示「杜阿拉综合楼」 |

### 验收流程

```
开发完成 → 本地自检（1–6）→ 测试（7–8）→ 前端验证（9–11）→ 权限与日志（12–13）→ 合并
```

### CI 自动检查

GitHub Actions 流水线（[`.github/workflows/ci.yml`](../.github/workflows/ci.yml)）覆盖验收项 1–3、5、7–8，合并前全绿：

```yaml
# 流水线步骤
- npm ci
- prisma generate + migrate deploy（PostgreSQL 16 服务）
- lint
- typecheck（api + web）
- test（Vitest 单元测试）
- test:e2e（API 集成测试）
- build（api + web）
- docker compose config + 构建 api/web 镜像
```

---

## 测试层级

| 层级 | 工具 | 范围 |
|------|------|------|
| 单元测试 | Vitest | 业务逻辑、权限判断、币种换算 |
| 集成测试 | Vitest | NestJS API 端点、Prisma 数据库交互 |
| E2E 测试 | Playwright | 关键业务流程（登录、采购、审批、导出） |

## 必测场景

### 权限（RBAC）

- 各角色仅能访问授权菜单与 API
- 跨项目数据不可越权读取
- 未登录请求返回 401

### 操作日志

- 每次写操作产生对应 audit_log 记录
- 日志包含操作人、时间、变更内容

### 多币种

- 金额存储与展示币种正确
- 汇率折算精度与舍入规则一致

### 导出

- 导出内容与列表筛选一致
- 导出操作产生日志

### 全文搜索

- 关键词命中预期记录
- 搜索结果不泄露无权限数据

### 业务规则

- 出库时库存不足被拒绝，数据库余额不为负
- 采购订单无供应商时无法创建
- 出库单无项目 ID 时无法创建
- 回款无合同关联时无法创建
- 预算记录无法被删除（仅可停用）
- 付款未审批时无法执行
- 采购申请未经项目主管审批无法下单
- 报销未经项目主管和财务审批无法完成
- 文档更新后旧版本仍可访问
- 材料价格变更后历史记录完整保留
- 自动翻译与人工翻译版本分别存在

### 多语言

- 三种语言界面文案完整
- 切换语言后格式本地化正确

### UI

- 响应式三档断点（Desktop / Tablet / Mobile）布局正常
- Dark Mode 切换无样式异常
- 页面 Console 无 error

## 模块测试

各模块详细测试用例见 `docs/modules/` 对应文档。模块验收须**同时满足**上文功能验收 13 项。

| 模块 | 验收文档 |
|------|----------|
| 登录权限 | [auth.md](./modules/auth.md#验收标准) |
| 项目 | [project.md](./modules/project.md#验收标准) |
| 材料 | [material.md](./modules/material.md#验收标准) |
| 采购 | [procurement.md](./modules/procurement.md#验收标准) |
| 仓库 | [warehouse.md](./modules/warehouse.md#验收标准) |
| 合同 | [contract.md](./modules/contract.md#验收标准) |
| 财务 | [finance.md](./modules/finance.md#验收标准) |
| 文档 | [document.md](./modules/document.md#验收标准) |
| 图纸 | [drawing.md](./modules/drawing.md#验收标准) |
| 翻译 | [translation.md](./modules/translation.md#验收标准) |
| 审批 | [workflow.md](./modules/workflow.md#验收标准) |
| Dashboard | [dashboard.md](./modules/dashboard.md#验收标准) |
| 通知 | [notification.md](./modules/notification.md#验收标准) |
| 系统设置 | [settings.md](./modules/settings.md#验收标准) |
| 日志 | [audit-log.md](./modules/audit-log.md#验收标准) |
