# 通知模块 (notification)

> 站内通知：审批待办、业务提醒、系统消息。

## 功能

| 功能 | 说明 |
|------|------|
| 站内通知 | 消息列表、已读/未读 |
| 审批提醒 | 待办审批到达时通知 |
| 库存预警 | 库存低于最低值时通知仓库管理员 |
| 业务提醒 | 采购到货、付款到期等 |
| 标记已读 | 单条/全部标记已读 |
| 通知偏好 | 用户设置接收类型（系统设置） |
| 异步推送 | BullMQ 队列发送 |

## 字段

### 通知 (notifications)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | uuid | — | 主键 |
| `userId` | uuid | 是 | 接收人 |
| `type` | enum | 是 | `approval` \| `inventory` \| `procurement` \| `finance` \| `system` |
| `title` | string | 是 | 标题 |
| `content` | text | 是 | 内容 |
| `link` | string | 否 | 跳转链接 |
| `isRead` | boolean | — | 是否已读，默认 false |
| `createdAt` | datetime | — | 创建时间 |

## 触发场景

| 场景 | 接收人 | 类型 |
|------|--------|------|
| 审批待办 | 审批人 | `approval` |
| 审批结果 | 发起人 | `approval` |
| 库存预警 | 仓库管理员 | `inventory` |
| 采购到货 | 采购/仓库 | `procurement` |
| 付款待审 | 财务/老板 | `finance` |
| 系统公告 | 全部/指定角色 | `system` |

## API

基础路径：`/api/v1/notifications`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/notifications` | 通知列表（分页） |
| GET | `/notifications/unread-count` | 未读数量 |
| PUT | `/notifications/:id/read` | 标记已读 |
| PUT | `/notifications/read-all` | 全部已读 |
| DELETE | `/notifications/:id` | 删除通知 |

## 权限

| 操作 | 说明 |
|------|------|
| 查看通知 | 仅查看自己的通知 |
| 系统公告 | 管理员可群发 |

## 操作日志

- 系统公告发送记 audit_log
- 用户已读操作不记日志

## 验收标准

| # | 验收项 | 通过条件 |
|---|--------|----------|
| 1 | 审批通知 | 提交审批后审批人收到通知 |
| 2 | 库存预警 | 低于最低库存触发通知 |
| 3 | 未读计数 | 顶栏/Dashboard 未读数准确 |
| 4 | 标记已读 | 单条/全部已读正常 |
| 5 | 权限隔离 | 用户仅看到自己的通知 |
| 6 | 测试全部通过 | 满足 [06-testing.md](../06-testing.md) 验收 13 项 |
