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
| 施工计划 | DHTMLX React Gantt 原生编辑：+ 添加、双击编辑、inline/拖拽、列 reorder |
| 施工内容 | 多级任务（大项→子项→分项）、前置依赖、负责人、工期 |
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

### 施工内容 (project_tasks)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `projectId` | uuid | 是 | 所属项目 |
| `parentId` | uuid | 否 | 父任务（大项/子项 WBS） |
| `code` | string | 否 | 任务编号 |
| `name` | string | 是 | 施工内容名称 |
| `zoneId` | uuid | 否 | 施工区域 |
| `assigneeId` | uuid | 否 | 负责人（项目经理/成员） |
| `laborCount` | int | 否 | 所需人工（人数） |
| `durationDays` | decimal | 否 | 所需工期（天） |
| `startDate` | date | 否 | 开始日期 |
| `endDate` | date | 否 | 结束日期 |
| `predecessorId` | uuid | 否 | 前置任务 |
| `prerequisites` | text | 否 | 前提条件说明 |
| `showInGantt` | boolean | — | 是否在甘特图显示，默认 true |
| `progress` | int | — | 进度 0–100 |
| `status` | enum | — | `pending` \| `in_progress` \| `completed` |
| `sortOrder` | int | — | 排序 |

### 施工计划页面（MVP）

路由：`/projects/[id]/schedule`

| 区域 | 说明 |
|------|------|
| 进度总览 | 施工项总数、已排期、平均进度、计划周期 |
| DHTMLX 甘特图 | Community MIT（`dhtmlx-gantt`），左侧网格 + 右侧时间轴 |
| 添加任务 | 网格「+」列点击添加（可开 lightbox 编辑） |
| 编辑 | 双击行打开编辑框；单元格 inline 编辑名称/日期/工期/进度 |
| WBS 升降级 | 官方 indent/outdent（Shift+← 升级 / Shift+→ 降级；工具栏按钮） |
| 排序 | 拖拽行调整 WBS 顺序；表头拖拽调整列顺序、拖边调整列宽 |
| 时间轴 | 滚轮缩放；拖拽条形图调整日期/工期/进度；拖拽连线设置前置任务 |
| 导出 | CSV / MS Project（XML，Community 版可用 DHTMLX 在线导出服务） |

> CSV **导入** API 保留；前端 MVP 暂不暴露导入入口，优先页面表单维护。  
> 甘特图使用 **DHTMLX Gantt Community MIT**（`dhtmlx-gantt`）；高级排程（自动调度、关键路径等）需 PRO 许可。

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

### 施工内容与甘特图

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/projects/:id/gantt` | 甘特图数据 + 进度总览 |
| GET | `/projects/:id/tasks` | 施工内容列表 |
| POST | `/projects/:id/tasks` | 新增施工内容 |
| PUT | `/projects/:id/tasks/:taskId` | 编辑施工内容 |
| DELETE | `/projects/:id/tasks/:taskId` | 删除施工内容 |
| PUT | `/projects/:id/tasks/reorder` | 拖拽排序（传 `orderedIds`） |
| GET | `/projects/:id/tasks/import-template` | CSV 导入模板下载 |
| POST | `/projects/:id/tasks/import` | CSV 导入（可选 `replace`） |
| GET | `/projects/:id/tasks/export` | 导出施工内容 CSV |

## 权限

| 操作 | 权限码 | 说明 |
|------|--------|------|
| 查看施工计划/甘特图/导出 CSV | `project.read` | 含项目成员只读 |
| 施工内容增删改/排序 | `project.task.manage` | 表格 inline 编辑、WBS 操作 |

| 操作 | 管理员 | 项目经理 | 老板 | 其他角色 |
|------|--------|----------|------|----------|
| 项目 CRUD | ✓ | 所辖项目 | — | — |
| 施工区域 | ✓ | 所辖项目 | 只读 | — |
| 成员管理 | ✓ | 所辖项目 | 只读 | — |
| 里程碑 | ✓ | 所辖项目 | 只读 | 只读 |
| 施工内容/甘特图 | ✓ | 所辖项目 | 只读 | 只读 |
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
| 9 | 导出/日志 | 项目列表导出、施工内容 CSV 导出成功，操作有 audit_log |
| 10 | 施工计划 | `/projects/:id/schedule` 甘特图 + 添加/双击编辑/拖拽排序，变更同步 API |
| 11 | 甘特图交互 | 滚轮缩放时间轴、前置任务连线、导出 MS Project XML |
| 12 | 测试全部通过 | 满足 [06-testing.md](../06-testing.md) 验收 13 项 |
