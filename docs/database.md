# 数据库设计原则 (database)

> 技术栈：PostgreSQL + Prisma（见 [07-tech-stack.md](./07-tech-stack.md)）

**数据库变更必须同步更新本文档。**

## 字符编码（UTF-8）

全系统使用 **UTF-8**，支持中文、法语、英文混排与检索。

### 数据库

```sql
CREATE DATABASE overbuild
  OWNER overbuild
  ENCODING 'UTF8'
  LC_COLLATE 'C'
  LC_CTYPE 'C'
  TEMPLATE template0;
```

Docker Compose 须设置 `POSTGRES_INITDB_ARGS: "--encoding=UTF8 --locale=C.UTF-8"`。

### 连接串

```
postgresql://overbuild:overbuild@localhost:5432/overbuild?schema=public&client_encoding=UTF8
```

### 文本字段

- 主显示名：`name`（中文或项目主语言）
- 法语名：`name_fr`（合同、图纸、材料等模块按需使用）
- 界面文案：i18n 资源（`zh` / `fr` / `en`），不写入业务表

### 损坏文本修复

因错误编码写入后名称变为 `??????` 的数据**无法自动还原原文**，须：

```bash
npm run db:fix-text    # 按规则修复已知损坏记录
npm run db:seed        # 同步种子数据并再次扫描
```

本地检查数据库编码（Windows PostgreSQL）：

```powershell
.\scripts\check-encoding.ps1
```

## 核心约定

- 所有业务表包含 `created_at`、`updated_at`
- 软删除使用 `deleted_at`（如适用）
- 主键统一使用 UUID 或雪花 ID
- 项目维度：业务数据通过 `project_id` 关联项目

## 多币种

金额相关表须包含：

| 字段 | 说明 |
|------|------|
| `amount` | 金额数值 |
| `currency` | 币种代码（ISO 4217，如 CNY、USD、EUR、XAF） |
| `exchange_rate` | 记账时汇率（可选，用于本位币折算） |
| `amount_base` | 折算为本位币的金额（可选） |

## 权限（RBAC）

核心表：

- `users` — 用户
- `roles` — 角色
- `permissions` — 权限（资源 + 操作）
- `role_permissions` — 角色-权限关联
- `user_roles` — 用户-角色关联（可含项目范围）

## 操作日志

`audit_logs` 表记录所有写操作与敏感读操作：

| 字段 | 说明 |
|------|------|
| `user_id` | 操作人 |
| `action` | 操作类型（create / update / delete / export / approve 等） |
| `resource` | 资源类型与 ID |
| `payload` | 变更前后快照（JSON） |
| `ip` | 客户端 IP |
| `created_at` | 操作时间 |

## 多语言

- 界面文案：i18n 资源文件或 `translations` 表
- 业务多语言字段：采用 `entity_translations`（entity_type, entity_id, locale, field, value）或 JSON 列

## 全文搜索

- 使用 PostgreSQL `tsvector` + GIN 索引
- 索引字段须与 RBAC 过滤逻辑配合
- Prisma 通过 `$queryRaw` 或中间件写入搜索向量

## 业务规则约束（数据层）

| 规则 | 实现要点 |
|------|----------|
| 库存 ≥ 0 | 出库事务内 `SELECT FOR UPDATE` 校验余额，不足则回滚 |
| 材料单分类 | `materials.category_id` 非空，唯一外键 |
| 材料编号唯一 | `materials.code` UNIQUE |
| 材料项目内编号唯一 | `(materials.project_id, materials.code)` UNIQUE |
| 材料归属项目 | `materials.project_id` 非空，专款专料专用 |
| 材料分类专业 | `material_categories.discipline` ∈ civil/mep/finishing/general |
| 出库关联项目 | `stock_outbound.project_id` 非空 |
| 采购关联供应商 | `purchase_orders.supplier_id` 非空 |
| 材料价格历史 | `material_price_history` 追加写入，禁止 UPDATE 旧记录 |
| 库存预警 | `materials.stock < materials.min_stock` 时标记预警 |
| 回款关联合同 | `collections.contract_id` 非空 |
| 付款须审批 | `payments.status` 须为 `approved` 才可执行 |
| 预算不可删除 | `budgets` 无物理删除，仅 `status` 停用 |
| 项目利润 | 计算视图：`SUM(incomes) - SUM(costs)` 按 `project_id` |
| 账户流水 | `account_transactions` 记录现金/银行每笔变动 |
| 汇率每日更新 | `exchange_rates` 按 `(currency, date)` 唯一，历史保留 |
| 文档版本 | `document_versions` 追加版本号，旧版本只读 |
| 中法双语字段 | 业务表 `name_zh` / `name_fr` 或 `entity_translations` |
| 人工/自动译文 | `translation_versions.source` = `auto` \| `manual` |
| 采购须审批 | `purchase_requests.status` 须 `approved` 才可下单 |
| 图纸须审阅 | `drawings.status` 须 `approved` 才可 `published` |
| 文档/图纸版本 | 版本号递增，旧版本只读 |
| 审批实例 | `approval_instances` 关联 business_id + type |

## Schema 变更记录

| 日期 | Migration | 说明 |
|------|-----------|------|
| 2026-07-05 | init_auth | users, roles, permissions, audit_logs, settings |
| 2026-07-05 | init_project | projects, project_zones, project_members, project_milestones |
| 2026-07-05 | project_tasks | 施工内容基础表 |
| 2026-07-05 | project_task_fields | labor_count, duration_days, prerequisites, predecessor_id, assignee_id |
| 2026-07-05 | project_task_gantt_flag | show_in_gantt |
| 2026-07-06 | workflow_approval | approval_instances, approval_records, approval_templates, notifications |
| 2026-07-06 | material | materials, material_categories, material_price_history, material_qrcodes, stock_transactions |
| 2026-07-06 | material_project_discipline | project_id, storage_location, category discipline |
| 2026-07-06 | procurement | purchase_requests, purchase_orders, suppliers, quotations |
| 2026-07-06 | warehouse | warehouses, stock_inbound, stock_outbound, stock_balances, stocktakes |
| 2026-07-08 | contract | contracts, contract_revisions, collections |
| 2026-07-08 | finance | incomes, payments, reimbursements, budgets, costs, invoices, cash_accounts, bank_accounts, account_transactions, currencies, exchange_rates |

---

## 数据表索引（按模块）

> 字段详情见各模块文档 `docs/modules/`。

### auth — [auth.md](./modules/auth.md)

| 表名 | 说明 |
|------|------|
| `users` | 用户 |
| `roles` | 角色 |
| `permissions` | 权限 |
| `role_permissions` | 角色-权限 |
| `user_roles` | 用户-角色（含 project_id） |

> `audit_logs` 见 [audit-log.md](./modules/audit-log.md)

### project — [project.md](./modules/project.md)

| 表名 | 说明 |
|------|------|
| `projects` | 项目 |
| `project_zones` | 施工区域 |
| `project_members` | 项目成员 |
| `project_milestones` | 里程碑 |
| `project_tasks` | 施工内容（WBS、甘特图、前置依赖） |

### procurement — [procurement.md](./modules/procurement.md)

| 表名 | 说明 |
|------|------|
| `purchase_requests` | 采购申请 |
| `purchase_request_items` | 申请明细 |
| `purchase_orders` | 采购订单 |
| `purchase_order_items` | 订单明细 |
| `quotations` | 询价记录 |
| `suppliers` | 供应商 |

### warehouse / material — [warehouse.md](./modules/warehouse.md) [material.md](./modules/material.md)

| 表名 | 说明 |
|------|------|
| `warehouses` | 仓库 |
| `materials` | 材料 |
| `material_categories` | 材料分类 |
| `material_price_history` | 价格历史 |
| `stock_inbound` | 入库单 |
| `stock_outbound` | 出库单 |
| `stock_items` | 出入库明细 |
| `stock_balances` | 库存余额 |
| `stock_transactions` | 库存流水 |
| `stocktakes` | 盘点单 |

### finance — [finance.md](./modules/finance.md)

| 表名 | 说明 |
|------|------|
| `incomes` | 收入 |
| `payments` | 付款单 |
| `collections` | 回款单 |
| `reimbursements` | 报销单 |
| `budgets` | 预算 |
| `budget_revisions` | 预算调整 |
| `costs` | 成本 |
| `invoices` | 发票 |
| `cash_accounts` | 现金账户 |
| `bank_accounts` | 银行账户 |
| `account_transactions` | 账户流水 |
| `currencies` | 币种 |
| `exchange_rates` | 汇率 |

### document — [document.md](./modules/document.md)

| 表名 | 说明 |
|------|------|
| `documents` | 文档 |
| `document_versions` | 文档版本 |
| `document_categories` | 文档分类 |

### drawing — [drawing.md](./modules/drawing.md)

| 表名 | 说明 |
|------|------|
| `drawings` | 图纸 |
| `drawing_versions` | 图纸版本 |
| `drawing_reviews` | 审阅记录 |

### translation — [translation.md](./modules/translation.md)

| 表名 | 说明 |
|------|------|
| `translation_tasks` | 翻译任务 |
| `translation_versions` | 译文版本 |
| `glossary_terms` | 术语库 |
| `entity_translations` | 实体多语言字段 |

### workflow — [workflow.md](./modules/workflow.md)

| 表名 | 说明 |
|------|------|
| `approval_instances` | 审批实例 |
| `approval_records` | 审批记录 |
| `approval_templates` | 流程模板 |

### contract — [contract.md](./modules/contract.md)

| 表名 | 说明 |
|------|------|
| `contracts` | 合同 |
| `contract_revisions` | 合同变更 |

### dashboard — [dashboard.md](./modules/dashboard.md)

> 无独立表，聚合查询各模块数据。

### notification — [notification.md](./modules/notification.md)

| 表名 | 说明 |
|------|------|
| `notifications` | 站内通知 |

### settings — [settings.md](./modules/settings.md)

| 表名 | 说明 |
|------|------|
| `system_settings` | 系统配置 |
| `user_preferences` | 用户偏好 |

### audit-log — [audit-log.md](./modules/audit-log.md)

| 表名 | 说明 |
|------|------|
| `audit_logs` | 操作审计日志 |
