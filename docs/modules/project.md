# 项目管理模块 (project)

> 核心数据归属维度，其他业务模块通过 `project_id` 关联。

## 功能

| 功能 | 说明 |
|------|------|
| 新增项目 | 项目立项，填写基本信息 |
| 编辑项目 | 修改项目信息 |
| 删除项目 | 软删除，有关联数据时禁止 |
| 施工区域 | 项目下多施工区域 CRUD |
| 项目成员 | 成员分配与项目内角色 |
| 里程碑 | 进度节点管理 |
| 项目列表 | 分页、搜索、排序、筛选 |
| 项目详情 | 汇总视图：合同、采购、库存、财务、利润 |
| 项目利润 | 实时展示收入、成本、利润（只读，数据来自财务） |
| 成本分析 | 按科目/区域汇总成本，预算对比 |
| Excel 导出 | 项目列表导出 |

## 字段

### 项目 (projects)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `code` | string | 是 | 项目编号，唯一 |
| `name` | string | 是 | 项目名称 |
| `nameFr` | string | 否 | 法语名称 |
| `location` | string | 否 | 项目地点 |
| `status` | enum | 是 | `planning` \| `active` \| `suspended` \| `completed` |
| `startDate` | date | 否 | 开始日期 |
| `endDate` | date | 否 | 结束日期 |
| `description` | text | 否 | 项目描述 |
| `managerId` | uuid | 是 | 项目经理 |
| `createdAt` | datetime | — | 创建时间 |
| `updatedAt` | datetime | — | 更新时间 |

### 施工区域 (project_zones)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `projectId` | uuid | 是 | 所属项目 |
| `name` | string | 是 | 区域名称 |
| `nameFr` | string | 否 | 法语名称 |
| `description` | text | 否 | 描述 |

### 项目成员 (project_members)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `projectId` | uuid | 是 | 项目 |
| `userId` | uuid | 是 | 用户 |
| `role` | string | 是 | 项目内角色 |

### 里程碑 (project_milestones)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `projectId` | uuid | 是 | 项目 |
| `name` | string | 是 | 里程碑名称 |
| `dueDate` | date | 否 | 计划日期 |
| `completedAt` | datetime | 否 | 完成时间 |
| `status` | enum | — | `pending` \| `completed` \| `overdue` |

## 业务规则

- 一个项目可包含**多个合同**
- 一个项目可对应**多个仓库**
- 一个项目可对应**多个采购订单**
- 一个项目可拥有**多个施工区域**
- **项目利润实时计算**：收入 − 成本，数据来自财务模块
- 删除项目前须检查：无进行中的采购/付款/库存

## API

基础路径：`/api/v1/projects`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/projects` | 项目列表 |
| GET | `/projects/:id` | 项目详情 |
| POST | `/projects` | 新增项目 |
| PUT | `/projects/:id` | 编辑项目 |
| DELETE | `/projects/:id` | 删除项目（软删除） |
| GET | `/projects/export` | Excel 导出 |
| GET | `/projects/:id/profit` | 项目利润（实时） |
| GET | `/projects/:id/cost-analysis` | 成本分析 |
| GET | `/projects/:id/summary` | 关联数据汇总 |

### 施工区域

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/projects/:id/zones` | 区域列表 |
| POST | `/projects/:id/zones` | 新增区域 |
| PUT | `/projects/:id/zones/:zoneId` | 编辑区域 |
| DELETE | `/projects/:id/zones/:zoneId` | 删除区域 |

### 项目成员

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/projects/:id/members` | 成员列表 |
| POST | `/projects/:id/members` | 添加成员 |
| DELETE | `/projects/:id/members/:memberId` | 移除成员 |

### 里程碑

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/projects/:id/milestones` | 里程碑列表 |
| POST | `/projects/:id/milestones` | 新增里程碑 |
| PUT | `/projects/:id/milestones/:milestoneId` | 编辑/完成 |

## 权限

| 操作 | 管理员 | 项目经理 | 老板 | 其他角色 |
|------|--------|----------|------|----------|
| 项目 CRUD | ✓ | 所辖项目 | — | — |
| 施工区域 | ✓ | 所辖项目 | 只读 | — |
| 成员管理 | ✓ | 所辖项目 | 只读 | — |
| 里程碑 | ✓ | 所辖项目 | 只读 | 只读 |
| 项目利润/成本 | ✓ | 所辖项目 | ✓ | 按授权 |
| Excel 导出 | ✓ | ✓ | ✓ | — |

## 操作日志

- 项目/区域/成员/里程碑 增删改
- 项目状态变更
- 导出

## 验收标准

| # | 验收项 | 通过条件 |
|---|--------|----------|
| 1 | 新增成功 | 项目创建，`managerId` 必填 |
| 2 | 编辑成功 | 字段更新，编号唯一 |
| 3 | 施工区域 | 一项目多区域 CRUD 正常 |
| 4 | 成员管理 | 成员绑定后按项目授权访问 |
| 5 | 分页/搜索/排序 | 列表参数正常 |
| 6 | 项目利润 | 与财务模块数据一致，实时更新 |
| 7 | 成本分析 | 成本汇总与预算对比正确 |
| 8 | 删除保护 | 有关联数据时拒绝删除 |
| 9 | 导出/日志 | 导出成功，操作有 audit_log |
| 10 | 测试全部通过 | 满足 [06-testing.md](../06-testing.md) 验收 13 项 |
