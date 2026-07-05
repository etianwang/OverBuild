# 仪表盘模块 (dashboard)

> 首页数据概览，按角色展示不同维度。

## 功能

| 功能 | 说明 |
|------|------|
| 项目概览 | 进行中项目数、状态分布 |
| 财务概览 | 收入、支出、利润汇总 |
| 采购概览 | 待审批采购、进行中订单 |
| 库存预警 | 低于最低库存的材料 |
| 待办审批 | 当前用户待审批数量 |
| 通知摘要 | 未读通知数 |
| 成本趋势 | 项目成本折线图（按月） |
| 利润排名 | 项目利润 Top N |
| 快捷入口 | 常用功能跳转 |

## 数据卡片（按角色）

| 角色 | 可见卡片 |
|------|----------|
| 管理员 | 全部 |
| 老板 | 财务、利润、项目、待办审批 |
| 项目经理 | 所辖项目、采购、库存、待办、成本 |
| 采购 | 采购申请/订单、供应商 |
| 仓库管理员 | 库存、预警、出入库 |
| 财务 | 收支、回款、付款、汇率 |
| 工程师 | 文档、图纸待办 |
| 翻译 | 翻译任务 |

## API

基础路径：`/api/v1/dashboard`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/dashboard/overview` | 总览数据（按角色过滤） |
| GET | `/dashboard/projects` | 项目统计 |
| GET | `/dashboard/finance` | 财务统计 |
| GET | `/dashboard/procurement` | 采购统计 |
| GET | `/dashboard/inventory-alerts` | 库存预警 |
| GET | `/dashboard/approvals-todo` | 待办审批数 |
| GET | `/dashboard/notifications-unread` | 未读通知数 |
| GET | `/dashboard/cost-trend` | 成本趋势（`?projectId=&months=6`） |
| GET | `/dashboard/profit-ranking` | 利润排名 |

### 响应示例

```json
{
  "success": true,
  "data": {
    "projects": { "active": 5, "completed": 12 },
    "finance": { "income": { "amount": 1000000, "currency": "CNY" }, "profit": { "amount": 200000, "currency": "CNY" } },
    "todoApprovals": 3,
    "unreadNotifications": 7,
    "inventoryAlerts": 2
  },
  "message": "查询成功"
}
```

## 权限

- 所有登录用户可访问 Dashboard
- 各卡片数据受 RBAC 与项目范围约束
- 老板/管理员可见全局汇总，其他角色仅可见授权范围

## 操作日志

- Dashboard 为只读聚合，不写 audit_log
- 导出（如有）须记录

## 验收标准

| # | 验收项 | 通过条件 |
|---|--------|----------|
| 1 | 角色视图 | 不同角色看到对应卡片 |
| 2 | 数据准确 | 与各模块实际数据一致 |
| 3 | 库存预警 | 预警数与 material 模块一致 |
| 4 | 待办数 | 与 workflow 待办一致 |
| 5 | 响应式 | Desktop First 布局正常 |
| 6 | Dark Mode | 图表与卡片深色模式正常 |
| 7 | 测试全部通过 | 满足 [06-testing.md](../06-testing.md) 验收 13 项 |
