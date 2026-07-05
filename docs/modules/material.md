# 材料管理 (material)

> 隶属仓库库存模块，见 [warehouse.md](./warehouse.md)

## 功能

| 功能 | 说明 |
|------|------|
| 新增材料 | 创建材料主数据 |
| 编辑材料 | 修改材料信息，价格变更写入历史 |
| 删除材料 | 软删除，有库存流水时禁止删除 |
| 材料分类 | 分类 CRUD，每个材料仅属一个分类 |
| 库存查询 | 按仓库、项目、分类筛选库存 |
| 库存预警 | 库存 < 最低库存时触发预警 |
| Excel 导入 | 批量导入材料主数据 |
| Excel 导出 | 按筛选条件导出材料列表 |
| 二维码 | 为材料生成二维码，扫码查看详情 |
| 图片 | 上传材料图片，支持预览 |
| 采购价格 | 维护采购价，保留价格历史 |
| 库存流水 | 查看入库/出库/盘点变动记录 |

## 字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `code` | string | 是 | 编号，唯一 |
| `name` | string | 是 | 名称 |
| `spec` | string | 否 | 规格 |
| `brand` | string | 否 | 品牌 |
| `model` | string | 否 | 型号 |
| `unit` | string | 是 | 单位（如：个、米、吨） |
| `categoryId` | uuid | 是 | 分类（仅一个） |
| `stock` | decimal | — | 库存数量（汇总或按仓库，只读） |
| `minStock` | decimal | 否 | 最低库存，用于预警 |
| `purchasePrice` | money | 否 | 采购价格（`amount` + `currency`） |
| `latestPrice` | money | — | 最近价格（从价格历史取最新，只读） |
| `imageUrl` | string | 否 | 图片 URL |
| `supplierId` | uuid | 否 | 默认供应商 |
| `createdAt` | datetime | — | 创建时间 |
| `updatedAt` | datetime | — | 更新时间 |

### 关联实体

- `material_categories` — 材料分类
- `material_price_history` — 价格历史（`material_id`, `price`, `currency`, `supplier_id`, `effective_at`）
- `stock_transactions` — 库存流水（入库/出库/盘点）
- `material_qrcode` — 二维码（`material_id`, `qrcode_url`）

## 业务规则

- 库存**不得小于零**
- 材料**只能属于一个分类**
- 材料价格变更须**追加**价格历史，不得覆盖
- `latestPrice` 自动取自价格历史最新记录
- 库存低于 `minStock` 时进入预警列表
- 删除材料前须检查：无库存余额、无未完成采购单

## API

基础路径：`/api/v1/materials`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/materials` | 列表（分页、搜索、排序、筛选） |
| GET | `/materials/:id` | 详情（含价格历史、库存流水摘要） |
| POST | `/materials` | 新增材料 |
| PUT | `/materials/:id` | 编辑材料 |
| DELETE | `/materials/:id` | 删除材料（软删除） |
| POST | `/materials/import` | Excel 批量导入 |
| GET | `/materials/export` | Excel 导出 |
| GET | `/materials/:id/qrcode` | 获取/生成二维码 |
| GET | `/materials/:id/stock-transactions` | 库存流水 |
| GET | `/materials/alerts` | 库存预警列表 |

### 列表查询参数

```
GET /api/v1/materials?page=1&pageSize=20&q=关键词&sort=code&order=asc&categoryId=uuid
```

### 请求示例（新增）

```json
{
  "code": "MAT-001",
  "name": "镀锌钢管",
  "spec": "DN50",
  "brand": "某某钢铁",
  "model": "GB/T3091",
  "unit": "米",
  "categoryId": "uuid",
  "minStock": 100,
  "purchasePrice": { "amount": 45.50, "currency": "CNY" },
  "supplierId": "uuid"
}
```

### 响应示例（列表）

```json
{
  "success": true,
  "data": {
    "list": [
      {
        "id": "uuid",
        "code": "MAT-001",
        "name": "镀锌钢管",
        "stock": 250,
        "minStock": 100,
        "latestPrice": { "amount": 45.50, "currency": "CNY" },
        "category": { "id": "uuid", "name": "管材" }
      }
    ],
    "page": 1,
    "pageSize": 20,
    "total": 150
  },
  "message": "查询成功"
}
```

## 权限

| 操作 | 管理员 | 采购 | 仓库 | 项目经理 | 老板 |
|------|--------|------|------|----------|------|
| 查看列表/详情 | ✓ | ✓ | ✓ | ✓ | ✓ |
| 新增 | ✓ | ✓ | ✓ | — | — |
| 编辑 | ✓ | ✓ | ✓ | — | — |
| 删除 | ✓ | — | ✓ | — | — |
| 分类管理 | ✓ | — | ✓ | — | — |
| Excel 导入 | ✓ | ✓ | ✓ | — | — |
| Excel 导出 | ✓ | ✓ | ✓ | ✓ | ✓ |
| 库存流水 | ✓ | ✓ | ✓ | ✓（只读） | ✓（只读） |
| 库存预警 | ✓ | ✓ | ✓ | ✓（只读） | ✓（只读） |
| 二维码 | ✓ | ✓ | ✓ | ✓ | ✓ |

> 仓库 = 仓库管理员角色

## 操作日志

以下操作须写入 `audit_logs`：

- 新增 / 编辑 / 删除材料
- Excel 导入 / 导出
- 价格变更
- 图片上传

## 验收标准

| # | 验收项 | 通过条件 |
|---|--------|----------|
| 1 | 新增成功 | POST 返回 `success: true`，字段完整入库，编号唯一校验 |
| 2 | 编辑成功 | PUT 返回 `success: true`，字段更新，`updatedAt` 刷新 |
| 3 | 库存正确 | 出入库后 `stock` 与流水一致，库存不为负 |
| 4 | 分页正常 | `page` / `pageSize` / `total` 响应正确 |
| 5 | 搜索正常 | `q` 参数匹配编号、名称、规格、品牌 |
| 6 | 排序正常 | `sort` + `order` 按指定字段排序 |
| 7 | 导入成功 | Excel 批量写入，重复编号报错，返回成功/失败统计 |
| 8 | 导出成功 | 导出内容与筛选一致，产生 audit_log |
| 9 | 日志正确 | 增删改、导入、导出均有 audit_log 记录 |
| 10 | 测试全部通过 | Vitest + Playwright 全绿，且满足 [06-testing.md](../06-testing.md) 功能验收 13 项 |
