# 文档管理模块 (document)

> 项目文档归档、版本控制、预览与翻译联动。

## 功能

| 功能 | 说明 |
|------|------|
| 上传文档 | 支持 PDF、DWG、图片、Office |
| 编辑文档 | 更新元数据，上传新版本 |
| 删除文档 | 软删除 |
| 版本管理 | **所有文档保存版本**，旧版本可查阅 |
| 文档预览 | 浏览器内直接预览 |
| 分类/标签 | 文档分类与标签管理 |
| 全文搜索 | 标题、标签、正文提取文本 |
| Excel 导出 | 文档清单 |
| 翻译联动 | 提交至翻译模块 |

## 字段

### 文档 (documents)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `code` | string | 是 | 文档编号，唯一 |
| `title` | string | 是 | 标题 |
| `titleFr` | string | 否 | 法语标题 |
| `projectId` | uuid | 是 | 关联项目 |
| `categoryId` | uuid | 否 | 分类 |
| `tags` | string[] | 否 | 标签 |
| `currentVersion` | int | — | 当前版本号（只读） |
| `status` | enum | — | `active` \| `archived` |
| `createdBy` | uuid | — | 上传人 |
| `createdAt` | datetime | — | 创建时间 |
| `updatedAt` | datetime | — | 更新时间 |

### 文档版本 (document_versions)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `documentId` | uuid | 是 | 文档 |
| `version` | int | 是 | 版本号，递增 |
| `fileUrl` | string | 是 | 文件存储路径 |
| `fileName` | string | 是 | 原始文件名 |
| `fileType` | enum | 是 | `pdf` \| `dwg` \| `image` \| `office` |
| `fileSize` | int | — | 文件大小（字节） |
| `uploadedBy` | uuid | — | 上传人 |
| `uploadedAt` | datetime | — | 上传时间 |

### 文档分类 (document_categories)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 是 | 分类名称 |
| `nameFr` | string | 否 | 法语名称 |
| `projectId` | uuid | 否 | 项目（空 = 全局） |

## 业务规则

- **所有文档保存版本** — 更新时追加新版本，旧版本只读
- 支持格式：**PDF、DWG、图片**（jpg/png/webp）、**Office**（doc/docx、xls/xlsx、ppt/pptx）
- **文档可预览** — PDF/图片/Office 浏览器内预览；DWG 使用预览服务
- 单文件大小上限 100MB（可配置）
- 删除为软删除，版本历史保留

## API

基础路径：`/api/v1/documents`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/documents` | 文档列表 |
| GET | `/documents/:id` | 文档详情 |
| POST | `/documents` | 上传文档（multipart） |
| PUT | `/documents/:id` | 编辑元数据 |
| DELETE | `/documents/:id` | 软删除 |
| POST | `/documents/:id/versions` | 上传新版本 |
| GET | `/documents/:id/versions` | 版本列表 |
| GET | `/documents/:id/versions/:version/preview` | 预览 |
| GET | `/documents/:id/versions/:version/download` | 下载 |
| POST | `/documents/:id/translate` | 提交翻译任务 |
| GET | `/documents/export` | Excel 导出 |

### 分类

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/document-categories` | 分类列表 |
| POST | `/document-categories` | 新增分类 |
| PUT | `/document-categories/:id` | 编辑分类 |

## 权限

| 操作 | 管理员 | 工程师 | 项目经理 | 翻译 | 老板 |
|------|--------|--------|----------|------|------|
| 上传/更新 | ✓ | ✓ | ✓ | — | — |
| 查看/预览 | ✓ | ✓ | ✓（本项目） | ✓（待翻译） | ✓ |
| 删除 | ✓ | 本人 | ✓（本项目） | — | — |
| 分类管理 | ✓ | — | ✓ | — | — |
| 提交翻译 | ✓ | ✓ | ✓ | — | — |
| Excel 导出 | ✓ | ✓ | ✓ | ✓ | ✓ |

## 操作日志

- 文档上传/更新/删除
- 新版本上传
- 预览/下载（可选记录）
- 导出

## 验收标准

| # | 验收项 | 通过条件 |
|---|--------|----------|
| 1 | 上传成功 | 支持 PDF/DWG/图片/Office |
| 2 | 版本管理 | 更新后旧版本仍可访问 |
| 3 | 预览 | 各格式浏览器内可预览 |
| 4 | 分类/标签 | CRUD 与筛选正常 |
| 5 | 全文搜索 | 标题/标签可搜索 |
| 6 | 翻译联动 | 可提交至翻译模块 |
| 7 | 权限 | 按项目与角色隔离 |
| 8 | 导出/日志 | 导出成功，操作有 audit_log |
| 9 | 测试全部通过 | 满足 [06-testing.md](../06-testing.md) 验收 13 项 |
