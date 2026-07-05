# 合同管理模块 (contract)

> 项目合同签订、变更、履约跟踪。回款必须关联合同。

## 功能

| 功能 | 说明 |
|------|------|
| 新增合同 | 创建合同，关联项目 |
| 编辑合同 | 修改合同信息 |
| 删除合同 | 软删除，有回款时禁止 |
| 合同变更 | 变更记录保留历史 |
| 履约跟踪 | 付款/回款节点进度 |
| 合同列表 | 分页、搜索、排序 |
| 合同详情 | 关联回款、收入、发票 |
| Excel 导出 | 合同清单导出 |

## 字段

### 合同 (contracts)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `code` | string | 是 | 合同编号，唯一 |
| `name` | string | 是 | 合同名称 |
| `nameFr` | string | 否 | 法语名称 |
| `projectId` | uuid | 是 | 关联项目 |
| `partyA` | string | 是 | 甲方 |
| `partyB` | string | 是 | 乙方 |
| `amount` | money | 是 | 合同金额 |
| `type` | enum | 是 | `construction` \| `procurement` \| `service` \| `other` |
| `signedAt` | date | 否 | 签订日期 |
| `startDate` | date | 否 | 开始日期 |
| `endDate` | date | 否 | 结束日期 |
| `status` | enum | — | `draft` \| `active` \| `completed` \| `terminated` |
| `collectedAmount` | money | — | 已回款金额（只读） |
| `attachmentUrl` | string | 否 | 合同附件 |
| `createdAt` | datetime | — | 创建时间 |
| `updatedAt` | datetime | — | 更新时间 |

### 合同变更 (contract_revisions)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `contractId` | uuid | 是 | 合同 |
| `changeType` | enum | 是 | `amount` \| `period` \| `terms` \| `other` |
| `before` | json | 是 | 变更前 |
| `after` | json | 是 | 变更后 |
| `reason` | text | 否 | 变更原因 |
| `changedBy` | uuid | — | 操作人 |

## 业务规则

- 一个项目可包含**多个合同**
- **回款必须关联合同**（财务模块强制）
- 合同变更须记录 `contract_revisions`，不覆盖历史
- 合同签订审批：项目主管 → 财务 → 老板（见 workflow）
- 有回款记录的合同不可删除

## API

基础路径：`/api/v1/contracts`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/contracts` | 合同列表 |
| GET | `/contracts/:id` | 合同详情 |
| POST | `/contracts` | 创建合同 |
| PUT | `/contracts/:id` | 编辑合同 |
| DELETE | `/contracts/:id` | 软删除 |
| POST | `/contracts/:id/submit` | 提交签订审批 |
| GET | `/contracts/:id/revisions` | 变更历史 |
| POST | `/contracts/:id/revisions` | 记录变更 |
| GET | `/contracts/:id/collections` | 关联回款 |
| GET | `/contracts/export` | Excel 导出 |

## 权限

| 操作 | 管理员 | 财务 | 项目经理 | 老板 | 其他 |
|------|--------|------|----------|------|------|
| 合同 CRUD | ✓ | ✓ | 查看/发起 | 查看/审批 | — |
| 合同变更 | ✓ | ✓ | — | 审批 | — |
| 查看回款进度 | ✓ | ✓ | ✓（本项目） | ✓ | 授权只读 |
| Excel 导出 | ✓ | ✓ | ✓ | ✓ | — |

## 操作日志

- 合同创建/编辑/删除
- 合同变更
- 审批提交
- 导出

## 验收标准

| # | 验收项 | 通过条件 |
|---|--------|----------|
| 1 | 合同 CRUD | 关联项目，编号唯一 |
| 2 | 一项目多合同 | 同项目可有多份合同 |
| 3 | 回款关联 | 回款须选合同，合同已回款金额更新 |
| 4 | 变更历史 | 变更记录完整保留 |
| 5 | 删除保护 | 有回款时不可删除 |
| 6 | 审批流程 | 签订须走审批链 |
| 7 | 分页/搜索 | 列表参数正常 |
| 8 | 导出/日志 | 导出成功，操作有 audit_log |
| 9 | 测试全部通过 | 满足 [06-testing.md](../06-testing.md) 验收 13 项 |
