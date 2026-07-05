# 日志模块 (audit-log)

> 操作审计日志，记录所有关键业务操作。

## 功能

| 功能 | 说明 |
|------|------|
| 日志记录 | 自动记录写操作与导出 |
| 日志查询 | 管理员按条件筛选查阅 |
| 日志详情 | 查看变更前后快照 |
| 日志导出 | Excel 导出审计记录 |
| 全文搜索 | 按操作人、资源、动作搜索 |

## 字段

### 操作日志 (audit_logs)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | uuid | — | 主键 |
| `userId` | uuid | 是 | 操作人 |
| `action` | enum | 是 | `create` \| `update` \| `delete` \| `export` \| `approve` \| `reject` \| `login` \| `logout` |
| `module` | string | 是 | 模块名 |
| `resource` | string | 是 | 资源类型 |
| `resourceId` | uuid | 否 | 资源 ID |
| `payload` | json | 否 | 变更前后快照 |
| `ip` | string | 否 | 客户端 IP |
| `userAgent` | string | 否 | 浏览器 UA |
| `createdAt` | datetime | — | 操作时间 |

## 记录范围

**必须记录**：

- 所有模块的数据创建、修改、删除
- 审批通过/驳回
- Excel 导出
- 权限与用户变更
- 登录/登出
- 系统配置变更

**不记录**：

- 普通列表查询
- Dashboard 只读聚合
- 标记通知已读

## API

基础路径：`/api/v1/audit-logs`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/audit-logs` | 日志列表（管理员） |
| GET | `/audit-logs/:id` | 日志详情 |
| GET | `/audit-logs/export` | Excel 导出 |

### 查询参数

```
GET /api/v1/audit-logs?page=1&pageSize=20&userId=uuid&module=material&action=create&startDate=2026-01-01&endDate=2026-12-31&q=关键词
```

## 权限

| 操作 | 管理员 | 其他角色 |
|------|--------|----------|
| 查看日志 | ✓ | — |
| 导出日志 | ✓ | — |
| 删除/修改日志 | — | 禁止 |

## 业务规则

- 日志**不可修改、不可删除**（仅管理员可查阅）
- 由 `AuditLogService` 统一写入，各模块 Service 层调用
- 敏感字段（密码）不得写入 payload

## 操作日志

- 日志导出本身记 audit_log

## 验收标准

| # | 验收项 | 通过条件 |
|---|--------|----------|
| 1 | 自动记录 | 各模块写操作均产生日志 |
| 2 | 快照完整 | payload 含变更前后值 |
| 3 | 权限隔离 | 非管理员无法查看 |
| 4 | 不可篡改 | 无删除/修改 API |
| 5 | 筛选搜索 | 按人/模块/动作/日期筛选 |
| 6 | 导出 | Excel 导出成功 |
| 7 | 测试全部通过 | 满足 [06-testing.md](../06-testing.md) 验收 13 项 |
