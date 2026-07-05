# API 设计规范

> 技术栈：NestJS + Swagger + JWT（见 [07-tech-stack.md](./07-tech-stack.md)）

## RESTful 风格

仅使用以下 HTTP 方法：

| 方法 | 用途 |
|------|------|
| **GET** | 查询资源（列表、详情、导出） |
| **POST** | 创建资源、提交动作（审批、导入） |
| **PUT** | 全量更新资源 |
| **DELETE** | 删除资源（软删除优先） |

约定：

- 资源路径使用复数名词：`/materials`、`/payments`
- 版本前缀：`/api/v1`
- 认证：Bearer Token（JWT）
- API 文档：Swagger UI（`/api/docs`）
- 请求/响应格式：JSON（导出除外）

---

## 统一返回格式

所有 JSON 接口均使用同一信封结构：

```json
{
  "success": true,
  "data": {},
  "message": "操作成功"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `success` | boolean | 请求是否成功 |
| `data` | any | 业务数据，失败时为 `null` |
| `message` | string | 提示信息（成功或错误描述） |

### 单条数据

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "code": "MAT-001",
    "name": "镀锌钢管"
  },
  "message": "查询成功"
}
```

### 列表数据（含分页）

```json
{
  "success": true,
  "data": {
    "list": [
      { "id": "uuid", "code": "MAT-001", "name": "镀锌钢管" }
    ],
    "page": 1,
    "pageSize": 20,
    "total": 150
  },
  "message": "查询成功"
}
```

### 操作成功（无返回体）

```json
{
  "success": true,
  "data": null,
  "message": "删除成功"
}
```

### 错误返回

HTTP 状态码体现错误类型，响应体仍使用统一格式：

```json
{
  "success": false,
  "data": null,
  "message": "无权限执行此操作"
}
```

校验错误可附带详情：

```json
{
  "success": false,
  "data": {
    "errors": [
      { "field": "code", "message": "编号已存在" }
    ]
  },
  "message": "参数校验失败"
}
```

---

## 统一分页

### 请求参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `page` | number | `1` | 当前页码，从 1 开始 |
| `pageSize` | number | `20` | 每页条数，最大 100 |

```
GET /api/v1/materials?page=1&pageSize=20
```

### 响应字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `page` | number | 当前页码 |
| `pageSize` | number | 每页条数 |
| `total` | number | 总记录数 |

三个分页字段放在 `data` 内，与 `list` 同级。

### 排序与筛选

通过查询参数传递，不改变信封结构：

```
GET /api/v1/materials?page=1&pageSize=20&q=钢管&sort=code&order=asc&categoryId=uuid
```

---

## 统一错误码

| HTTP 状态码 | 含义 | 使用场景 |
|-------------|------|----------|
| **400** | Bad Request | 请求格式错误、缺少必填参数 |
| **401** | Unauthorized | 未登录或 Token 无效/过期 |
| **403** | Forbidden | 已登录但无权限 |
| **404** | Not Found | 资源不存在 |
| **422** | Unprocessable Entity | 参数校验失败、业务规则冲突 |
| **500** | Internal Server Error | 服务器内部错误 |

### NestJS 实现

- 全局 `ResponseInterceptor` 包装 `{ success, data, message }`
- 全局 `HttpExceptionFilter` 统一错误响应
- 分页响应：`data.list` + `data.page` / `data.pageSize` / `data.total`
- 校验失败：`ValidationPipe` → **422**
- 权限不足：`ForbiddenException` → **403**

---

## 权限

- 每个端点声明所需 `permission`
- `JwtAuthGuard` + `PermissionsGuard` 统一校验
- 未登录返回 **401**，无权限返回 **403**
- 数据级权限：按 `project_id` 与用户角色过滤查询结果

## 操作日志

写操作（POST / PUT / DELETE）及导出（GET export）须自动写入 `audit_logs`。

## 多币种

金额字段请求/响应均携带 `amount` + `currency`，服务端校验币种合法性。

## 导出

```
GET /api/v1/{resource}/export?format=xlsx&{filters}
```

- 返回 Excel 文件流（非 JSON 信封）
- 记录导出日志

## 全文搜索

```
GET /api/v1/{resource}/search?q={keyword}&page=1&pageSize=20
```

- 结果集受 RBAC 约束
- 跨模块全局搜索：`GET /api/v1/search?q={keyword}`
- 搜索接口仍使用统一 JSON 返回格式

## 多语言

- 请求头 `Accept-Language: zh | fr | en` 决定 `message` 与错误提示语言
- 业务多语言实体通过 `locale` 参数或翻译子资源访问
