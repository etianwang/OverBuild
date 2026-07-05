# 材料采购模块 (procurement)

> 采购全流程：申请 → 审批 → 订单 → 到货 → 入库

## 功能

| 功能 | 说明 |
|------|------|
| 采购申请 | 创建 PR，关联项目与物料 |
| 提交审批 | 提交项目主管审批 |
| 询价 | 向供应商询价、比价 |
| 采购订单 | 创建 PO，**必须关联供应商与项目** |
| 到货跟踪 | 记录到货状态，触发入库 |
| 供应商管理 | 供应商 CRUD |
| 价格历史 | 采购价格写入材料价格历史 |
| Excel 导出 | 申请单、订单、供应商导出 |
| 全文搜索 | 单号、供应商、物料名 |

## 字段

### 采购申请 (purchase_requests)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `code` | string | 是 | 申请单号，唯一 |
| `projectId` | uuid | 是 | 关联项目 |
| `requesterId` | uuid | 是 | 申请人 |
| `status` | enum | — | `draft` \| `pending` \| `approved` \| `rejected` \| `ordered` |
| `remark` | text | 否 | 备注 |
| `createdAt` | datetime | — | 创建时间 |

### 采购申请明细 (purchase_request_items)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `requestId` | uuid | 是 | 申请单 |
| `materialId` | uuid | 是 | 材料 |
| `quantity` | decimal | 是 | 数量 |
| `unit` | string | 是 | 单位 |

### 采购订单 (purchase_orders)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `code` | string | 是 | 订单号，唯一 |
| `projectId` | uuid | **是** | 关联项目 |
| `supplierId` | uuid | **是** | 关联供应商 |
| `requestId` | uuid | 否 | 来源申请单 |
| `totalAmount` | money | 是 | 订单总额 |
| `status` | enum | — | `draft` \| `confirmed` \| `partial` \| `received` \| `cancelled` |
| `orderedAt` | datetime | — | 下单时间 |

### 供应商 (suppliers)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `code` | string | 是 | 供应商编号，唯一 |
| `name` | string | 是 | 名称 |
| `contact` | string | 否 | 联系人 |
| `phone` | string | 否 | 电话 |
| `email` | string | 否 | 邮箱 |
| `address` | string | 否 | 地址 |

## 业务规则

- 每次采购**必须关联供应商**
- 每个采购订单**必须关联项目**
- 材料价格变更写入 `material_price_history`，不覆盖
- 采购申请**必须经项目主管审批**后方可下单
- 到货完成后触发仓库入库

## API

基础路径：`/api/v1/procurement`

### 采购申请

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/purchase-requests` | 申请列表 |
| POST | `/purchase-requests` | 创建申请 |
| PUT | `/purchase-requests/:id` | 编辑申请 |
| POST | `/purchase-requests/:id/submit` | 提交审批 |
| GET | `/purchase-requests/export` | Excel 导出 |

### 采购订单

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/purchase-orders` | 订单列表 |
| POST | `/purchase-orders` | 创建订单（须含 projectId + supplierId） |
| PUT | `/purchase-orders/:id` | 编辑订单 |
| PUT | `/purchase-orders/:id/receive` | 到货确认 |
| GET | `/purchase-orders/export` | Excel 导出 |

### 询价

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/quotations` | 询价记录 |
| POST | `/quotations` | 创建询价 |
| PUT | `/quotations/:id` | 更新报价 |

### 供应商

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/suppliers` | 供应商列表 |
| POST | `/suppliers` | 新增供应商 |
| PUT | `/suppliers/:id` | 编辑供应商 |
| DELETE | `/suppliers/:id` | 删除供应商 |
| GET | `/suppliers/export` | Excel 导出 |

## 权限

| 操作 | 管理员 | 采购 | 项目经理 | 财务 | 老板 |
|------|--------|------|----------|------|------|
| 采购申请 CRUD | ✓ | ✓ | 创建/查看 | 只读 | 只读 |
| 提交/审批申请 | ✓ | ✓ | 审批 | — | 超额度审批 |
| 采购订单 | ✓ | ✓ | 查看 | 只读 | 只读 |
| 供应商管理 | ✓ | ✓ | 查看 | 查看 | 查看 |
| 询价 | ✓ | ✓ | 查看 | — | — |
| Excel 导出 | ✓ | ✓ | ✓ | ✓ | ✓ |

## 操作日志

- 申请/订单/供应商 增删改
- 审批提交与结果
- 到货确认
- 导出

## 验收标准

| # | 验收项 | 通过条件 |
|---|--------|----------|
| 1 | 采购申请 | 创建成功，关联项目 |
| 2 | 审批流程 | 未审批不可下单，项目主管审批通过 |
| 3 | 采购订单 | 无 supplierId 或 projectId 时创建失败 |
| 4 | 价格历史 | 下单后材料价格历史追加记录 |
| 5 | 到货入库 | 到货确认后仓库可入库 |
| 6 | 供应商 CRUD | 编号唯一，搜索正常 |
| 7 | 分页/搜索/排序 | 列表参数正常 |
| 8 | 导出/日志 | 导出成功，操作有 audit_log |
| 9 | 测试全部通过 | 满足 [06-testing.md](../06-testing.md) 验收 13 项 |
