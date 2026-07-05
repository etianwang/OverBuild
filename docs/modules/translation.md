# 翻译模块 (translation)

> 多语言翻译、术语库、自动翻译与人工译文管理。

## 功能

| 功能 | 说明 |
|------|------|
| 翻译任务 | 创建、分配、处理翻译任务 |
| 自动翻译 | 调用翻译服务生成初稿（BullMQ 异步） |
| 人工翻译 | 译员编辑并提交人工版本 |
| 版本对比 | 自动版 vs 人工版对照 |
| 术语库 | 中/法/英术语维护 |
| 字段翻译 | 业务实体字段中法双语 |
| 全文搜索 | 术语、原文、译文 |
| Excel 导出 | 术语表、任务列表 |

## 支持语言

- 中文（zh）
- 法语（fr）
- 英语（en）— 界面 i18n，术语库可选

## 字段

### 翻译任务 (translation_tasks)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `code` | string | 是 | 任务编号 |
| `sourceType` | enum | 是 | `document` \| `drawing` \| `entity` |
| `sourceId` | uuid | 是 | 来源 ID |
| `sourceLang` | enum | 是 | 源语言 |
| `targetLang` | enum | 是 | 目标语言 |
| `status` | enum | — | `pending` \| `auto` \| `manual` \| `completed` |
| `assigneeId` | uuid | 否 | 译员 |
| `createdAt` | datetime | — | 创建时间 |

### 译文版本 (translation_versions)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `taskId` | uuid | 是 | 任务 |
| `source` | enum | 是 | `auto` \| `manual` |
| `content` | json | 是 | 译文内容（字段级或全文） |
| `translatedBy` | uuid | 否 | 译员（人工版） |
| `createdAt` | datetime | — | 创建时间 |

### 术语 (glossary_terms)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `source` | string | 是 | 原文 |
| `zh` | string | 否 | 中文 |
| `fr` | string | 否 | 法语 |
| `en` | string | 否 | 英语 |
| `category` | string | 否 | 分类 |

### 实体双语字段

业务表采用 `name_zh` / `name_fr` 或 `entity_translations` 表存储。

## 业务规则

- **所有字段支持中法双语** — 业务实体须存储中文与法文
- **支持自动翻译** — BullMQ 异步调用翻译 API
- **保留人工翻译版本** — `auto` 与 `manual` 分别存档，**人工版本优先展示**
- 术语库在翻译时自动匹配替换

## API

基础路径：`/api/v1/translation`

### 翻译任务

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/tasks` | 任务列表 |
| POST | `/tasks` | 创建任务 |
| GET | `/tasks/:id` | 任务详情 |
| POST | `/tasks/:id/auto-translate` | 触发自动翻译 |
| PUT | `/tasks/:id/manual` | 提交人工译文 |
| PUT | `/tasks/:id/assign` | 分配译员 |
| GET | `/tasks/export` | Excel 导出 |

### 术语库

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/glossary` | 术语列表 |
| POST | `/glossary` | 新增术语 |
| PUT | `/glossary/:id` | 编辑术语 |
| DELETE | `/glossary/:id` | 删除术语 |
| POST | `/glossary/import` | Excel 导入 |
| GET | `/glossary/export` | Excel 导出 |

### 实体翻译

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/entities/:type/:id/translations` | 获取实体译文 |
| PUT | `/entities/:type/:id/translations` | 更新实体译文 |

## 权限

| 操作 | 管理员 | 翻译 | 项目经理 | 工程师 |
|------|--------|------|----------|--------|
| 创建任务 | ✓ | ✓ | ✓ | 提交来源 |
| 自动翻译 | ✓ | ✓ | — | — |
| 人工翻译 | ✓ | ✓ | — | — |
| 术语库 | ✓ | ✓ | 查看 | 查看 |
| 分配译员 | ✓ | — | ✓ | — |
| Excel 导出 | ✓ | ✓ | ✓ | — |

## 操作日志

- 任务创建/分配/完成
- 自动翻译触发
- 人工译文提交
- 术语增删改
- 导出

## 验收标准

| # | 验收项 | 通过条件 |
|---|--------|----------|
| 1 | 创建任务 | 关联文档/图纸/实体 |
| 2 | 自动翻译 | 异步生成 auto 版本 |
| 3 | 人工翻译 | manual 版本独立存储 |
| 4 | 优先展示 | 有 manual 时展示 manual |
| 5 | 术语库 | 中/法/英 CRUD 与导入导出 |
| 6 | 实体双语 | 业务字段中法双语存储 |
| 7 | 分页/搜索 | 术语与任务可搜索 |
| 8 | 导出/日志 | 导出成功，操作有 audit_log |
| 9 | 测试全部通过 | 满足 [06-testing.md](../06-testing.md) 验收 13 项 |
