# 模块文档规范

每个模块文档须包含以下章节（参考 [material.md](./material.md)）：

| 章节 | 内容 |
|------|------|
| 功能 | 功能列表与说明 |
| 字段 | 核心实体字段定义 |
| 业务规则 | 模块级约束 |
| API | REST 端点（`/api/v1/...`） |
| 权限 | 角色 × 操作矩阵 |
| 操作日志 | 须记录的 audit_log 动作 |
| 验收标准 | 模块验收项 + 引用 [06-testing.md](../06-testing.md) 13 项 |

## 模块清单（15 个）

| # | 模块 | 文档 | 状态 |
|---|------|------|------|
| 1 | 登录权限 | [auth.md](./auth.md) | ✅ |
| 2 | 项目 | [project.md](./project.md) | ✅ |
| 3 | 材料 | [material.md](./material.md) | ✅ |
| 4 | 采购 | [procurement.md](./procurement.md) | ✅ |
| 5 | 仓库 | [warehouse.md](./warehouse.md) | ✅ |
| 6 | 合同 | [contract.md](./contract.md) | ✅ |
| 7 | 财务 | [finance.md](./finance.md) | ✅ |
| 8 | 文档 | [document.md](./document.md) | ✅ |
| 9 | 图纸 | [drawing.md](./drawing.md) | ✅ |
| 10 | 翻译 | [translation.md](./translation.md) | ✅ |
| 11 | 审批 | [workflow.md](./workflow.md) | ✅ |
| 12 | Dashboard | [dashboard.md](./dashboard.md) | ✅ |
| 13 | 通知 | [notification.md](./notification.md) | ✅ |
| 14 | 系统设置 | [settings.md](./settings.md) | ✅ |
| 15 | 日志 | [audit-log.md](./audit-log.md) | ✅ |

## 模块关系

```
登录权限 (auth) ──→ 所有模块
项目 (project)  ──→ 合同、采购、仓库、财务、文档、图纸
材料 (material) ←── 仓库 (warehouse) ←── 采购 (procurement)
合同 (contract) ──→ 财务回款
财务 (finance)  ←── 审批 (workflow)
Dashboard       ←── 聚合各模块数据
通知 (notification) ←── 审批、库存、业务事件
日志 (audit-log) ←── 所有写操作
系统设置 (settings) ──→ 全局配置 + 个人偏好
```

## 后端实现要求

每个模块须包含：Repository、Service、Controller、DTO、Validation、Swagger、Unit Test、E2E Test。

见 `.cursor/rules/nestjs-module.mdc`。

## 实现顺序

一个模块一个模块，完成后再做下一个。详见 [TASKS.md](../../TASKS.md)。

```
auth → audit-log → settings → project → workflow
  → material → procurement → warehouse
  → contract → finance
  → document → drawing → translation
  → notification → dashboard
```

单模块流程：读文档 → 数据库 → API → 前端 → 测试 → 完成
