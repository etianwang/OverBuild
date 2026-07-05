# 仓库库存模块 (warehouse)

> 入库、出库、盘点、库存管理。材料主数据见 [material.md](./material.md)。

## 功能

| 功能 | 说明 |
|------|------|
| 仓库管理 | 仓库/库位 CRUD，一项目多仓库 |
| 入库 | 采购到货入库、退库 |
| 出库 | 领用出库，**必须关联项目** |
| 库存盘点 | 盘点单，调整库存差异 |
| 库存查询 | 按项目、仓库、材料查询余额 |
| 库存预警 | 库存 < 最低库存（见 material 模块） |
| 库存流水 | 所有变动记录 |
| Excel 导出 | 库存报表、出入库流水 |
| 全文搜索 | 单号、材料、仓库 |

## 子模块

- [材料管理 (material)](./material.md) — 材料 CRUD、分类、导入导出、二维码

## 字段

### 仓库 (warehouses)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `code` | string | 是 | 仓库编号，唯一 |
| `name` | string | 是 | 名称 |
| `projectId` | uuid | 是 | 关联项目 |
| `address` | string | 否 | 地址 |
| `status` | enum | — | `active` \| `inactive` |

### 入库单 (stock_inbound)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `code` | string | 是 | 入库单号 |
| `warehouseId` | uuid | 是 | 仓库 |
| `projectId` | uuid | 是 | 项目 |
| `purchaseOrderId` | uuid | 否 | 来源采购订单 |
| `type` | enum | 是 | `purchase` \| `return` \| `adjustment` |
| `status` | enum | — | `draft` \| `confirmed` |
| `inboundAt` | datetime | — | 入库时间 |

### 出库单 (stock_outbound)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `code` | string | 是 | 出库单号 |
| `warehouseId` | uuid | 是 | 仓库 |
| `projectId` | uuid | **是** | 关联项目（强制） |
| `zoneId` | uuid | 否 | 施工区域 |
| `type` | enum | 是 | `usage` \| `transfer` |
| `status` | enum | — | `draft` \| `confirmed` |
| `outboundAt` | datetime | — | 出库时间 |

### 出入库明细 (stock_items)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `materialId` | uuid | 是 | 材料 |
| `quantity` | decimal | 是 | 数量 |
| `unit` | string | 是 | 单位 |

### 库存余额 (stock_balances)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `warehouseId` | uuid | 是 | 仓库 |
| `materialId` | uuid | 是 | 材料 |
| `projectId` | uuid | 是 | 项目 |
| `quantity` | decimal | — | 当前库存（≥ 0） |

## 业务规则

- **库存不得小于零** — 出库前校验，不足则拒绝（事务 + `SELECT FOR UPDATE`）
- 每次出库**必须关联项目**
- 一个项目可对应**多个仓库**
- 出库计入项目成本（财务模块）
- 盘点差异须审批后调整

## API

基础路径：`/api/v1/warehouse`

### 仓库

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/warehouses` | 仓库列表 |
| POST | `/warehouses` | 新增仓库 |
| PUT | `/warehouses/:id` | 编辑仓库 |
| DELETE | `/warehouses/:id` | 停用仓库 |

### 入库

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/inbound` | 入库单列表 |
| POST | `/inbound` | 创建入库单 |
| PUT | `/inbound/:id` | 编辑入库单 |
| POST | `/inbound/:id/confirm` | 确认入库 |
| GET | `/inbound/export` | Excel 导出 |

### 出库

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/outbound` | 出库单列表 |
| POST | `/outbound` | 创建出库单（须含 projectId） |
| PUT | `/outbound/:id` | 编辑出库单 |
| POST | `/outbound/:id/confirm` | 确认出库 |
| GET | `/outbound/export` | Excel 导出 |

### 盘点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/stocktakes` | 盘点单列表 |
| POST | `/stocktakes` | 创建盘点 |
| POST | `/stocktakes/:id/confirm` | 确认盘点调整 |

### 库存

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/stock-balances` | 库存余额查询 |
| GET | `/stock-transactions` | 库存流水 |
| GET | `/stock-balances/export` | 库存报表导出 |

## 权限

| 操作 | 管理员 | 仓库管理员 | 采购 | 项目经理 | 老板 |
|------|--------|------------|------|----------|------|
| 仓库 CRUD | ✓ | ✓ | 只读 | 只读 | 只读 |
| 入库 | ✓ | ✓ | 只读 | 只读 | 只读 |
| 出库 | ✓ | ✓ | — | 只读 | 只读 |
| 盘点 | ✓ | ✓ | — | 只读 | 只读 |
| 库存查询 | ✓ | ✓ | ✓ | ✓（本项目） | ✓ |
| Excel 导出 | ✓ | ✓ | ✓ | ✓ | ✓ |

材料权限详见 [material.md](./material.md)。

## 操作日志

- 仓库/入库/出库/盘点 增删改与确认
- 库存变动
- 导出

## 验收标准

| # | 验收项 | 通过条件 |
|---|--------|----------|
| 1 | 入库成功 | 库存增加，流水记录正确 |
| 2 | 出库成功 | 库存减少，须含 projectId |
| 3 | 库存不为负 | 库存不足时出库被拒绝 |
| 4 | 一项目多仓库 | 同项目多仓库库存独立 |
| 5 | 盘点调整 | 差异确认后库存更新 |
| 6 | 成本归集 | 出库后项目成本增加 |
| 7 | 分页/搜索 | 列表参数正常 |
| 8 | 导出/日志 | 导出成功，操作有 audit_log |
| 9 | 测试全部通过 | 满足 [06-testing.md](../06-testing.md) 验收 13 项 |
