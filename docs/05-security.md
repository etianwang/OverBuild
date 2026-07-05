# 安全与权限

> 技术栈：JWT + NestJS Guards（见 [07-tech-stack.md](./07-tech-stack.md)）

## RBAC 权限模型

系统必须采用 RBAC（Role-Based Access Control）：

```
用户 (User) ──N:M──> 角色 (Role) ──N:M──> 权限 (Permission)
```

### 权限粒度

- **功能权限**：菜单、按钮、API 端点
- **数据权限**：按项目、部门或全局范围隔离

### 权限编码规范

格式：`{module}.{resource}.{action}`

| 模块 | 示例 |
|------|------|
| auth | `auth.user.create`、`auth.role.update` |
| project | `project.read`、`project.create`、`project.zone.manage` |
| procurement | `procurement.request.create`、`procurement.order.confirm` |
| warehouse | `warehouse.inbound.confirm`、`warehouse.outbound.create` |
| material | `material.create`、`material.import`、`material.export` |
| finance | `finance.payment.approve`、`finance.budget.create` |
| document | `document.upload`、`document.preview` |
| drawing | `drawing.review`、`drawing.publish` |
| translation | `translation.task.assign`、`translation.glossary.manage` |
| workflow | `workflow.approve`、`workflow.template.manage` |

### 预置角色

| 角色 | 权限范围 |
|------|----------|
| 管理员 | 全局配置与用户管理 |
| 老板 | 全局只读 + 审批 + 成本分析 |
| 项目经理 | 所辖项目读写 + 采购/报销审批 |
| 采购 | 采购模块 + 关联项目 |
| 仓库管理员 | 仓库/材料模块 + 关联项目 |
| 财务 | 财务模块 + 关联项目 + 付款审批 |
| 工程师 | 文档/图纸读写 |
| 翻译 | 翻译模块读写 |

各模块权限矩阵见 `docs/modules/{module}.md`。

## 认证

- 用户名 + 密码登录
- 密码加密存储（bcrypt / argon2）
- JWT Bearer Token，NestJS `JwtAuthGuard` 全局校验
- Token 过期与刷新机制（Refresh Token 存 Redis）
- 登录失败限流（5 次 / 15 分钟）

## NestJS 守卫

```typescript
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('material.create')
@Post()
create() { ... }
```

- 未登录 → **401**
- 无权限 → **403**
- 数据权限在 Service/Repository 层按 `project_id` 过滤

## 操作日志

**所有操作必须记录日志**，包括但不限于：

- 数据创建、修改、删除
- 审批通过/驳回
- 数据导出
- 权限变更
- 登录/登出

日志不可被普通用户修改或删除，仅管理员可审计查阅。

## 数据安全

- 传输层 HTTPS
- 敏感字段脱敏展示
- 导出文件含操作人水印或元数据（可选）

## 多币种安全

- 汇率来源可追溯，变更记日志
- 金额修改须记录变更前后值
