# OverBuild

驻外工程项目综合管理平台。

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 环境变量
cp .env.example .env

# 3. 启动数据库
docker compose up -d

# 4. 数据库迁移与种子
npm run db:generate
npm run db:migrate
npm run db:seed

# 5. 启动开发服务
npm run dev:api   # http://localhost:3001
npm run dev:web   # http://localhost:3000
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
