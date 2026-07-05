# 系统设置模块 (settings)

> 系统全局配置与个人偏好设置。

## 功能

### 系统设置（管理员）

| 功能 | 说明 |
|------|------|
| 基础配置 | 系统名称、Logo、默认语言 |
| 币种管理 | 启用币种列表 |
| 汇率配置 | 汇率来源、自动更新开关 |
| 文件配置 | 上传大小限制、允许格式 |
| 审批模板 | 审批流程模板（见 workflow） |
| 通知配置 | 全局通知开关 |

### 个人设置（所有用户）

| 功能 | 说明 |
|------|------|
| 语言切换 | 中文 / 法语 / 英语 |
| 主题切换 | 亮色 / 深色 |
| 通知偏好 | 选择接收的通知类型 |
| 修改密码 | 修改自己的密码 |
| 个人信息 | 姓名、邮箱、电话 |

## 字段

### 系统配置 (system_settings)

| 字段 | 类型 | 说明 |
|------|------|------|
| `key` | string | 配置键，唯一 |
| `value` | json | 配置值 |
| `description` | string | 说明 |
| `updatedBy` | uuid | 最后修改人 |

常用配置键：

| key | 说明 | 示例值 |
|-----|------|--------|
| `app.name` | 系统名称 | `"OverBuild"` |
| `app.default_locale` | 默认语言 | `"zh"` |
| `app.base_currency` | 本位币 | `"CNY"` |
| `file.max_size_mb` | 上传限制 | `100` |
| `exchange.auto_update` | 汇率自动更新 | `true` |

### 用户偏好 (user_preferences)

| 字段 | 类型 | 说明 |
|------|------|------|
| `userId` | uuid | 用户 |
| `locale` | enum | `zh` \| `fr` \| `en` |
| `theme` | enum | `light` \| `dark` \| `system` |
| `notificationPrefs` | json | 通知偏好 |

## API

基础路径：`/api/v1/settings`

### 系统设置（管理员）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/settings/system` | 获取系统配置 |
| PUT | `/settings/system` | 更新系统配置 |
| GET | `/settings/system/:key` | 获取单项配置 |

### 个人设置

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/settings/profile` | 个人信息 |
| PUT | `/settings/profile` | 更新个人信息 |
| PUT | `/settings/password` | 修改密码 |
| GET | `/settings/preferences` | 用户偏好 |
| PUT | `/settings/preferences` | 更新偏好 |

## 权限

| 操作 | 管理员 | 其他用户 |
|------|--------|----------|
| 系统配置 | ✓ | — |
| 个人设置 | ✓ | ✓ |
| 修改密码 | ✓ | 仅自己 |

## 操作日志

- 系统配置变更
- 密码修改（不记录密码内容）

## 验收标准

| # | 验收项 | 通过条件 |
|---|--------|----------|
| 1 | 系统配置 | 管理员可读写，其他用户 403 |
| 2 | 语言切换 | 切换后界面文案更新 |
| 3 | 主题切换 | Dark Mode 正常 |
| 4 | 修改密码 | 旧密码验证，新密码生效 |
| 5 | 通知偏好 | 关闭某类型后不再接收 |
| 6 | 日志 | 系统配置变更有 audit_log |
| 7 | 测试全部通过 | 满足 [06-testing.md](../06-testing.md) 验收 13 项 |
