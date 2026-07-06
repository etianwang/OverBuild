# 材料管理 (material)

> 隶属仓库库存模块，见 [warehouse.md](./warehouse.md)

## 功能

| 功能 | 说明 |
|------|------|
| 新增材料 | 创建材料主数据，**必须归属项目** |
| 编辑材料 | 修改材料信息，价格变更写入历史 |
| 删除材料 | 软删除，有库存流水时禁止删除 |
| 材料分类 | 分类 CRUD，每个材料仅属一个分类；分类带**专业/团队**维度 |
| 库存查询 | 按仓库、项目、分类、专业筛选库存 |
| 库存预警 | 库存 < 最低库存时触发预警 |
| Excel 导入 | 批量导入材料主数据 |
| Excel 导出 | 按筛选条件导出材料列表 |
| 二维码 | 为材料生成二维码，扫码查看详情 |
| 图片 | 上传材料图片，支持预览 |
| 采购价格 | 维护采购价，保留价格历史 |
| 库存流水 | 查看入库/出库/盘点变动记录 |

## 字段

### 材料 (materials)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `code` | string | 是 | 编号，**项目内唯一** |
| `name` | string | 是 | 名称 |
| `spec` | string | 否 | 规格 |
| `brand` | string | 否 | 品牌 |
| `model` | string | 否 | 型号 |
| `unit` | string | 是 | 单位（如：个、米、吨） |
| `categoryId` | uuid | 是 | 分类（仅一个） |
| `projectId` | uuid | 是 | **归属项目**（专款专料专用） |
| `storageLocation` | string | 否 | **储存位置**（如 `杜阿拉仓-A区-3号架`）；同一地区可有多个仓库/库位 |
| `warehouseId` | uuid | 否 | 关联仓库（`warehouses` 表，仓库模块接入后必填入库场景） |
| `stock` | decimal | — | 库存数量（按项目+库位汇总，只读） |
| `minStock` | decimal | 否 | 最低库存，用于预警 |
| `purchasePrice` | money | 否 | 采购价格（`amount` + `currency`） |
| `latestPrice` | money | — | 最近价格（从价格历史取最新，只读） |
| `imageUrl` | string | 否 | 图片 URL |
| `supplierId` | uuid | 否 | 默认供应商 |
| `createdAt` | datetime | — | 创建时间 |
| `updatedAt` | datetime | — | 更新时间 |

### 材料分类 (material_categories)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `code` | string | 是 | 分类编号，唯一 |
| `name` | string | 是 | 分类名称 |
| `discipline` | enum | 是 | **专业/团队**：`civil` 土建 · `mep` 机电 · `finishing` 精装 · `general` 通用 |
| `description` | string | 否 | 说明 |

#### 专业（discipline）预设

| 值 | 中文 | 典型用途 |
|----|------|----------|
| `civil` | 土建 | 型钢、混凝土、砌筑、土方等 |
| `mep` | 机电 | 管材、电缆、暖通设备、电气元件等 |
| `finishing` | 精装 | 饰面、门窗五金、洁具、涂料等 |
| `general` | 通用 | 跨专业辅材、办公/安全用品等 |

### 关联实体

- `material_categories` — 材料分类（含 `discipline`）
- `material_price_history` — 价格历史（`material_id`, `price`, `currency`, `supplier_id`, `effective_at`）
- `stock_transactions` — 库存流水（入库/出库/盘点）
- `material_qrcode` — 二维码（`material_id`, `qrcode_url`）
- `projects` — 材料归属项目
- `warehouses` — 储存仓库（见 [warehouse.md](./warehouse.md)）

## 业务规则

- **专款专料专用** — 每条材料必须绑定 `projectId`；列表与导出默认按用户数据权限过滤项目
- **编号项目内唯一** — `(projectId, code)` 联合唯一，不同项目可复用相同编号
- 库存**不得小于零**
- 材料**只能属于一个分类**
- 分类须指定 `discipline`，便于按土建/机电/精装团队分工管理
- `storageLocation` 描述物理库位；`warehouseId` 在仓库模块上线后与仓库主数据关联
- 材料价格变更须**追加**价格历史，不得覆盖
- `latestPrice` 自动取自价格历史最新记录
- 库存低于 `minStock` 时进入预警列表（按项目维度统计）
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
GET /api/v1/materials?page=1&pageSize=20&q=关键词&sort=code&order=asc
  &categoryId=uuid&projectId=uuid&discipline=civil&warehouseId=uuid
```

| 参数 | 说明 |
|------|------|
| `projectId` | 按归属项目筛选 |
| `discipline` | 按分类专业筛选（`civil` / `mep` / `finishing` / `general`） |
| `categoryId` | 按分类 ID 筛选 |

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
  "projectId": "uuid",
  "storageLocation": "杜阿拉仓-B区-2号架",
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
        "projectId": "uuid",
        "project": { "id": "uuid", "code": "PRJ-DEMO-001", "name": "杜阿拉综合楼" },
        "storageLocation": "杜阿拉仓-B区-2号架",
        "stock": 250,
        "minStock": 100,
        "latestPrice": { "amount": 45.50, "currency": "CNY" },
        "category": {
          "id": "uuid",
          "name": "机电管材",
          "discipline": "mep"
        }
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
| 查看列表/详情 | ✓ | ✓ | ✓ | ✓（所辖项目） | ✓ |
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
| 1 | 新增成功 | POST 返回 `success: true`，`projectId` 必填，编号项目内唯一 |
| 2 | 编辑成功 | PUT 返回 `success: true`，字段更新，`updatedAt` 刷新 |
| 3 | 项目隔离 | 项目经理仅能看到所辖项目材料 |
| 4 | 专业筛选 | `discipline` 参数正确过滤土建/机电/精装分类 |
| 5 | 库存正确 | 出入库后 `stock` 与流水一致，库存不为负 |
| 6 | 分页正常 | `page` / `pageSize` / `total` 响应正确 |
| 7 | 搜索正常 | `q` 参数匹配编号、名称、规格、品牌、储存位置 |
| 8 | 排序正常 | `sort` + `order` 按指定字段排序 |
| 9 | 导入成功 | Excel 批量写入，重复编号报错，返回成功/失败统计 |
| 10 | 导出成功 | 导出内容与筛选一致，产生 audit_log |
| 11 | 日志正确 | 增删改、导入、导出均有 audit_log 记录 |
| 12 | 测试全部通过 | Vitest + Playwright 全绿，且满足 [06-testing.md](../06-testing.md) 功能验收 13 项 |
