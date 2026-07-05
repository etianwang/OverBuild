# 图纸管理模块 (drawing)

> 工程图纸上传、版本管理、审阅与发布。

## 功能

| 功能 | 说明 |
|------|------|
| 上传图纸 | 支持 DWG、PDF、图片 |
| 编辑图纸 | 更新元数据，上传新版本 |
| 删除图纸 | 软删除 |
| 版本管理 | 版本历史，旧版本可查阅 |
| 图纸审阅 | 工程师提交 → 项目主管审阅批准 |
| 图纸发布 | 审阅通过后发布 |
| 分类管理 | 按专业/类型分类 |
| 全文搜索 | 图号、名称、专业 |
| Excel 导出 | 图纸目录 |
| 预览 | DWG/PDF 在线预览 |

## 字段

### 图纸 (drawings)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `drawingNo` | string | 是 | 图号，唯一 |
| `name` | string | 是 | 图纸名称 |
| `nameFr` | string | 否 | 法语名称 |
| `projectId` | uuid | 是 | 关联项目 |
| `discipline` | enum | 是 | 专业：`arch` \| `struct` \| `mep` \| `civil` \| `other` |
| `zoneId` | uuid | 否 | 施工区域 |
| `currentVersion` | int | — | 当前版本（只读） |
| `status` | enum | — | `draft` \| `reviewing` \| `approved` \| `published` |
| `createdBy` | uuid | — | 上传人 |
| `createdAt` | datetime | — | 创建时间 |

### 图纸版本 (drawing_versions)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `drawingId` | uuid | 是 | 图纸 |
| `version` | int | 是 | 版本号 |
| `fileUrl` | string | 是 | 文件路径 |
| `fileType` | enum | 是 | `dwg` \| `pdf` \| `image` |
| `uploadedBy` | uuid | — | 上传人 |
| `uploadedAt` | datetime | — | 上传时间 |

### 审阅记录 (drawing_reviews)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `drawingId` | uuid | 是 | 图纸 |
| `version` | int | 是 | 审阅版本 |
| `reviewerId` | uuid | 是 | 审阅人 |
| `comment` | text | 否 | 审阅意见 |
| `result` | enum | 是 | `approved` \| `rejected` |
| `reviewedAt` | datetime | — | 审阅时间 |

## 业务规则

- 图纸发布须经过审阅：**工程师 → 项目主管**
- 版本更新后旧版本保留只读
- 已发布图纸修改须上传新版本并重新审阅
- 支持 DWG 格式（与文档模块规则一致）

## API

基础路径：`/api/v1/drawings`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/drawings` | 图纸列表 |
| GET | `/drawings/:id` | 图纸详情 |
| POST | `/drawings` | 上传图纸 |
| PUT | `/drawings/:id` | 编辑元数据 |
| DELETE | `/drawings/:id` | 软删除 |
| POST | `/drawings/:id/versions` | 上传新版本 |
| GET | `/drawings/:id/versions` | 版本列表 |
| GET | `/drawings/:id/versions/:version/preview` | 预览 |
| POST | `/drawings/:id/submit-review` | 提交审阅 |
| POST | `/drawings/:id/review` | 审阅（批准/驳回） |
| POST | `/drawings/:id/publish` | 发布 |
| GET | `/drawings/export` | Excel 导出 |

## 权限

| 操作 | 管理员 | 工程师 | 项目经理 | 老板 | 其他 |
|------|--------|--------|----------|------|------|
| 上传/更新 | ✓ | ✓ | ✓ | — | — |
| 查看/预览 | ✓ | ✓ | ✓（本项目） | ✓ | 授权只读 |
| 提交审阅 | ✓ | ✓ | — | — | — |
| 审阅/批准 | ✓ | — | ✓ | — | — |
| 发布 | ✓ | — | ✓ | — | — |
| 删除 | ✓ | 本人 | ✓ | — | — |
| Excel 导出 | ✓ | ✓ | ✓ | ✓ | — |

## 操作日志

- 图纸上传/更新/删除
- 审阅与发布
- 导出

## 验收标准

| # | 验收项 | 通过条件 |
|---|--------|----------|
| 1 | 上传成功 | DWG/PDF/图片均可上传 |
| 2 | 版本管理 | 新版本追加，旧版本可查阅 |
| 3 | 审阅流程 | 工程师提交 → 项目主管批准 |
| 4 | 发布控制 | 未审阅不可发布 |
| 5 | 预览 | DWG/PDF 可在线预览 |
| 6 | 分页/搜索 | 图号、名称、专业可搜索 |
| 7 | 权限 | 按项目与角色隔离 |
| 8 | 导出/日志 | 导出成功，操作有 audit_log |
| 9 | 测试全部通过 | 满足 [06-testing.md](../06-testing.md) 验收 13 项 |
