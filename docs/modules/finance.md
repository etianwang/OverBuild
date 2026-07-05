# 财务模块 (finance)

## 功能

| 功能 | 说明 |
|------|------|
| 收入 | 登记项目收入，关联合同与项目 |
| 付款 | 付款单创建与执行，**必须审批** |
| 报销 | 报销申请，**项目主管 + 财务**两级审批 |
| 回款 | 客户回款登记，**必须关联合同** |
| 预算 | 项目预算编制与调整，**不可删除** |
| 成本 | 项目成本归集（采购、出库、人工等） |
| 利润 | 利润计算（收入 − 成本） |
| 发票 | 开票登记、进项/销项发票管理 |
| 现金 | 现金账户流水与余额 |
| 银行 | 银行账户流水与余额 |
| 审批 | 付款、报销等财务审批流 |
| 日报 | 每日资金收支汇总报表 |
| 月报 | 每月财务汇总报表 |
| 项目利润 | 按项目实时计算利润 |
| 币种 | 币种维护（ISO 4217） |
| 汇率 | 汇率每日更新，历史可追溯 |
| 合同 | 合同签订、变更、履约（见 [contract.md](./contract.md)） |

---

## 子功能详述

### 收入

- 登记项目收入金额、币种、日期、摘要
- 可关联合同与项目
- 计入项目收入与利润

### 付款

- 创建付款单（供应商、金额、币种、付款方式：现金/银行）
- 必须经过审批方可执行
- 付款后更新现金/银行账户余额
- 关联采购订单或合同（可选）

### 回款

- 登记客户回款
- **必须关联合同**
- 更新项目收入与合同回款进度

### 预算

- 按项目编制预算（分科目/分阶段）
- 支持预算调整（追加版本，旧版本保留）
- **禁止物理删除**，仅可停用
- 实际成本与预算对比

### 成本

- 自动归集：采购订单、材料出库、报销等
- 手动补录成本项
- 按项目、施工区域汇总
- 支持多币种，折算为本位币

### 利润

- 公式：`利润 = 收入 − 成本`
- 项目维度实时计算，随业务数据变动自动更新
- 支持按币种查看及本位币汇总

### 发票

- 销项发票（开给客户）
- 进项发票（供应商发票）
- 字段：发票号、金额、币种、税率、开票日期、关联合同/付款

### 现金 / 银行

- 多账户管理（现金账户、银行账户）
- 每笔收支产生流水记录
- 实时余额计算
- 付款/回款自动记入对应账户

### 审批

- 付款审批（强制）
- 报销审批：项目主管 → 财务（强制）
- 审批状态：待审 / 通过 / 驳回

### 日报 / 月报

- **日报**：当日收入、付款、回款、现金/银行变动汇总
- **月报**：当月收支、成本、利润、预算执行率
- 支持 Excel 导出

### 项目利润

- 每个项目展示：收入、成本、利润、利润率
- 实时刷新，项目详情页只读展示
- 老板/项目经理/财务可查看

### 币种 / 汇率

- 币种列表：CNY、USD、EUR、XAF 等（ISO 4217）
- 汇率**每日更新**（BullMQ 定时任务）
- 历史汇率保留，折算时取业务日期当日汇率
- 所有金额字段携带 `amount` + `currency`

### 合同

> 独立模块，详见 [contract.md](./contract.md)

---

## 核心实体

| 实体 | 表名（草案） | 说明 |
|------|-------------|------|
| 收入 | `incomes` | 项目收入记录 |
| 付款单 | `payments` | 付款申请与执行 |
| 回款单 | `collections` | 客户回款，关联合同 |
| 报销单 | `reimbursements` | 报销申请，双级审批 |
| 预算 | `budgets` | 项目预算，不可删除 |
| 预算调整 | `budget_revisions` | 预算变更历史 |
| 成本 | `costs` | 项目成本明细 |
| 发票 | `invoices` | 进销项发票 |
| 现金账户 | `cash_accounts` | 现金账户 |
| 银行账户 | `bank_accounts` | 银行账户 |
| 账户流水 | `account_transactions` | 现金/银行流水 |
| 合同 | `contracts` | 见 [contract.md](./contract.md) |
| 币种 | `currencies` | 币种主数据 |
| 汇率 | `exchange_rates` | 按日汇率 |
| 项目利润 | — | 计算视图，非物理表 |

---

## 字段（通用金额结构）

所有金额字段统一结构：

```json
{
  "amount": 10000.00,
  "currency": "CNY"
}
```

### 付款单

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `code` | string | 是 | 付款单号 |
| `projectId` | uuid | 是 | 关联项目 |
| `payee` | string | 是 | 收款方 |
| `amount` | money | 是 | 付款金额 |
| `paymentMethod` | enum | 是 | `cash` \| `bank` |
| `accountId` | uuid | 是 | 付款账户 |
| `status` | enum | — | `draft` \| `pending` \| `approved` \| `paid` \| `rejected` |
| `approvedAt` | datetime | — | 审批通过时间 |

### 回款单

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `code` | string | 是 | 回款单号 |
| `contractId` | uuid | **是** | 关联合同（强制） |
| `projectId` | uuid | 是 | 关联项目 |
| `amount` | money | 是 | 回款金额 |
| `receivedAt` | datetime | 是 | 到账日期 |
| `accountId` | uuid | 是 | 收款账户 |

### 报销单

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `code` | string | 是 | 报销单号 |
| `projectId` | uuid | 是 | 关联项目 |
| `applicantId` | uuid | 是 | 申请人 |
| `amount` | money | 是 | 报销金额 |
| `description` | text | 否 | 说明 |
| `status` | enum | — | `draft` \| `pending` \| `approved` \| `rejected` \| `paid` |

### 预算

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `projectId` | uuid | 是 | 关联项目 |
| `category` | string | 是 | 预算科目 |
| `amount` | money | 是 | 预算金额 |
| `status` | enum | — | `active` \| `inactive`（不可删除） |

### 发票

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `invoiceNo` | string | 是 | 发票号 |
| `type` | enum | 是 | `sales`（销项）\| `purchase`（进项） |
| `amount` | money | 是 | 含税金额 |
| `taxRate` | decimal | 否 | 税率 |
| `issuedAt` | date | 是 | 开票日期 |
| `contractId` | uuid | 否 | 关联合同 |

---

## 业务规则

- **付款必须审批** — `status` 为 `approved` 后才可执行付款
- **回款必须关联合同** — `contractId` 非空，否则拒绝创建
- **项目利润实时计算** — 收入 − 成本，自动更新
- **汇率每日更新** — BullMQ 定时拉取/录入当日汇率
- **预算不能删除** — 仅 `active` → `inactive`，禁止 DELETE
- **报销申请**须项目主管 + 财务两级审批

---

## API

基础路径：`/api/v1/finance`

### 收入

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/incomes` | 收入列表 |
| POST | `/incomes` | 登记收入 |
| GET | `/incomes/:id` | 收入详情 |
| GET | `/incomes/export` | Excel 导出 |

### 付款

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/payments` | 付款单列表 |
| POST | `/payments` | 创建付款单 |
| PUT | `/payments/:id` | 编辑付款单 |
| POST | `/payments/:id/submit` | 提交审批 |
| POST | `/payments/:id/approve` | 审批通过 |
| POST | `/payments/:id/reject` | 审批驳回 |
| POST | `/payments/:id/execute` | 执行付款 |
| GET | `/payments/export` | Excel 导出 |

### 回款

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/collections` | 回款列表 |
| POST | `/collections` | 登记回款（须含 contractId） |
| GET | `/collections/:id` | 回款详情 |
| GET | `/collections/export` | Excel 导出 |

### 报销

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/reimbursements` | 报销列表 |
| POST | `/reimbursements` | 创建报销 |
| PUT | `/reimbursements/:id` | 编辑报销 |
| POST | `/reimbursements/:id/submit` | 提交审批 |
| GET | `/reimbursements/export` | Excel 导出 |

### 预算

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/budgets` | 预算列表 |
| POST | `/budgets` | 创建预算 |
| PUT | `/budgets/:id` | 调整预算 |
| PATCH | `/budgets/:id/deactivate` | 停用预算（不可 DELETE） |
| GET | `/budgets/:id/execution` | 预算执行对比 |

### 成本

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/costs` | 成本明细列表 |
| POST | `/costs` | 手动补录成本 |
| GET | `/costs/summary` | 按项目汇总 |

### 发票

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/invoices` | 发票列表 |
| POST | `/invoices` | 登记发票 |
| PUT | `/invoices/:id` | 编辑发票 |
| GET | `/invoices/export` | Excel 导出 |

### 现金 / 银行

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/cash-accounts` | 现金账户列表 |
| GET | `/bank-accounts` | 银行账户列表 |
| GET | `/accounts/:id/transactions` | 账户流水 |
| GET | `/accounts/:id/balance` | 账户余额 |

### 报表

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/reports/daily` | 日报 |
| GET | `/reports/monthly` | 月报 |
| GET | `/reports/daily/export` | 日报 Excel 导出 |
| GET | `/reports/monthly/export` | 月报 Excel 导出 |

### 项目利润

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/projects/:id/profit` | 项目利润实时数据 |
| GET | `/projects/profit-summary` | 全部项目利润汇总 |

### 币种 / 汇率

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/currencies` | 币种列表 |
| GET | `/exchange-rates` | 汇率列表（按日期） |
| GET | `/exchange-rates/latest` | 最新汇率 |
| POST | `/exchange-rates` | 录入/更新当日汇率 |

> 合同 API 见 [contract.md](./contract.md)

---

## 权限

| 操作 | 管理员 | 财务 | 项目经理 | 老板 | 采购 |
|------|--------|------|----------|------|------|
| 收入登记 | ✓ | ✓ | — | — | — |
| 付款创建/执行 | ✓ | ✓ | — | 审批 | — |
| 回款登记 | ✓ | ✓ | — | — | — |
| 报销申请 | ✓ | ✓ | ✓（发起） | — | — |
| 报销审批 | ✓ | ✓ | 项目主管 | — | — |
| 预算编制 | ✓ | ✓ | 查看 | 查看 | — |
| 成本查看 | ✓ | ✓ | ✓（本项目） | ✓ | ✓（只读） |
| 发票管理 | ✓ | ✓ | — | 查看 | — |
| 现金/银行 | ✓ | ✓ | — | 查看 | — |
| 付款审批 | ✓ | ✓ | — | ✓ | — |
| 日报/月报 | ✓ | ✓ | ✓（本项目） | ✓ | — |
| 项目利润 | ✓ | ✓ | ✓（本项目） | ✓ | — |
| 汇率管理 | ✓ | ✓ | — | 查看 | — |
| Excel 导出 | ✓ | ✓ | ✓（本项目） | ✓ | — |

> 合同权限见 [contract.md](./contract.md)

---

## 操作日志

以下操作须写入 `audit_logs`：

- 收入 / 付款 / 回款 / 报销 / 预算 / 成本 / 发票 的增删改
- 付款审批（通过/驳回）与执行
- 汇率更新
- 合同变更
- 日报/月报导出

---

## 验收标准

| # | 验收项 | 通过条件 |
|---|--------|----------|
| 1 | 收入登记 | 收入写入成功，项目利润同步更新 |
| 2 | 付款审批 | 未审批付款无法执行；审批后可付款 |
| 3 | 回款关联合同 | 无 contractId 时创建失败 |
| 4 | 报销审批 | 项目主管 + 财务两级审批 |
| 5 | 预算不可删除 | DELETE 返回 405，仅可 deactivate |
| 6 | 成本归集 | 采购/出库后成本自动计入项目 |
| 7 | 利润计算 | 项目利润 = 收入 − 成本，实时准确 |
| 8 | 发票管理 | 进销项发票 CRUD 正常 |
| 9 | 现金/银行流水 | 付款/回款后账户余额正确 |
| 10 | 日报/月报 | 报表数据与明细一致，可导出 |
| 11 | 汇率每日更新 | 当日汇率存在，历史汇率可查询 |
| 12 | 多币种 | 金额字段均含 currency，折算正确 |
| 13 | 日志正确 | 所有写操作与导出均有 audit_log |
| 14 | 测试全部通过 | Vitest + Playwright 全绿，且满足 [06-testing.md](../06-testing.md) 功能验收 13 项 |
