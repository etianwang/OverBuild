# OverBuild

驻外工程项目综合管理平台。

## 开发策略

**先功能实现，后容器化与部署。** 按 `TASKS.md` 模块顺序逐个完成 API + 前端 + 测试。

## 快速开始（本地开发）

```bash
# 1. 安装依赖
npm install

# 2. 环境变量
cp .env.example .env
# 编辑 .env 中的 DATABASE_URL，指向本地 PostgreSQL

# 3. 数据库迁移与种子（需本地 PostgreSQL 运行中）
npm run db:generate
npm run db:migrate
npm run db:seed

# 4. 启动开发服务
npm run dev:api   # http://localhost:3001
npm run dev:web   # http://localhost:3000
```

### 数据库（二选一）

**方式 A：本地安装 PostgreSQL**（推荐，开发阶段）

```
DATABASE_URL="postgresql://user:password@localhost:5432/overbuild?schema=public"
```

**方式 B：Docker**（可选，部署阶段再重点使用）

```bash
docker compose up -d
```

## 默认账号

- 用户名：`admin`
- 密码：`admin123`

## 文档

见 `docs/` 目录。实现顺序见 `TASKS.md`。

## 脚本

| 命令 | 说明 |
|------|------|
| `npm run lint` | ESLint |
| `npm run build` | 构建 API + Web |
| `npm run test` | 单元测试 |
| `npm run test:e2e` | E2E 测试 |
