# OverBuild

驻外工程项目综合管理平台。

## 界面预览

基于 **shadcn/ui**，支持亮色 / 深色主题与中法英多语言。演示数据默认账号：`admin` / `admin123`。

<p align="center">
  <img src="docs/assets/screenshots/login-light.png" alt="登录页" width="420" />
  <img src="docs/assets/screenshots/dashboard.png" alt="工作台" width="720" />
</p>

<p align="center">
  <em>登录 · 工作台（统计卡片、成本趋势、利润排名、库存预警）</em>
</p>

| 材料采购 | 财务管理 | 翻译管理 |
| --- | --- | --- |
| ![材料采购](docs/assets/screenshots/procurement.png) | ![财务管理](docs/assets/screenshots/finance.png) | ![翻译管理](docs/assets/screenshots/translation.png) |

| 施工计划（甘特图） | 深色模式 |
| --- | --- |
| ![施工计划](docs/assets/screenshots/project-schedule.png) | ![深色模式工作台](docs/assets/screenshots/dashboard-dark.png) |

更多页面截图见 [`docs/assets/screenshots/`](docs/assets/screenshots/)（共 20 张）。本地重新生成：

```bash
docker compose up -d --build
docker compose exec api sh -c "cd /app && npx prisma db seed"
npm install --no-save playwright@1.51.1 && npx playwright install chromium
node scripts/capture-screenshots.mjs
# 端口非默认时：SCREENSHOT_BASE_URL=http://localhost:3020 SCREENSHOT_API_URL=http://localhost:3021/api/v1 node scripts/capture-screenshots.mjs
```

---

## 环境要求

### 操作系统


| 场景   | 支持                                                        |
| ---- | --------------------------------------------------------- |
| 本地开发 | Linux（推荐 Ubuntu 22.04 / 24.04 LTS）                        |
| 生产部署 | **Ubuntu 22.04 / 24.04 LTS + [宝塔面板](https://www.bt.cn/)** |


### 基础工具（必选）


| 依赖          | 版本                 | 用途                | 安装与验证                                    |
| ----------- | ------------------ | ----------------- | ---------------------------------------- |
| **Git**     | 2.x+               | 克隆仓库              | `sudo apt install git` · `git --version` |
| **Node.js** | **20.x LTS**       | 构建、测试；方式 A 本地开发需用 | 见下方安装说明 · `node -v` 应输出 `v20.x.x`        |
| **npm**     | **10+**（随 Node 安装） | 依赖管理与脚本           | `npm -v`                                 |


**Ubuntu 安装 Node.js 20（推荐 nvm）：**

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
```

或使用 NodeSource：

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```



### 容器（必选）


| 依赖                 | 版本      | 用途                          | 安装与验证                                                               |
| ------------------ | ------- | --------------------------- | ------------------------------------------------------------------- |
| **Docker Engine**  | 24+     | 运行 PostgreSQL、Redis、API、Web | [Ubuntu 安装文档](https://docs.docker.com/engine/install/ubuntu/)       |
| **Docker Compose** | **v2+** | 多容器编排                       | `sudo apt install docker-compose-plugin` · `docker compose version` |


安装 Docker 后，将当前用户加入 `docker` 组（需重新登录生效）：

```bash
sudo usermod -aG docker $USER
```

所有安装方式均基于 Docker Compose，无需本机单独安装 PostgreSQL / Redis。

### 硬件与端口


| 项   | 建议                                                                  |
| --- | ------------------------------------------------------------------- |
| 内存  | 开发 ≥ 8 GB；全栈 Docker 建议 ≥ 16 GB                                      |
| 磁盘  | ≥ 5 GB 可用空间（含 `node_modules` 与 Docker 镜像/卷）                         |
| 端口  | 开发默认 **3000/3001/5432/6379**；生产由宝塔 Nginx 对外 **80/443**，Docker 端口仅本机 |


端口冲突时可通过环境变量 `WEB_PORT`、`API_PORT`、`POSTGRES_PORT`、`REDIS_PORT` 调整（见「环境变量」）。

### 可选


| 依赖                | 说明                                          |
| ----------------- | ------------------------------------------- |
| **DeepL API Key** | 自动翻译功能；Free 版 Key 以 `:fx` 结尾。未配置时使用 mock 翻译 |
| **宝塔面板**          | 生产环境默认，用于 Nginx 反代、SSL、防火墙                  |




### 环境自检

```bash
node -v                   # v20.x.x
npm -v                    # 10.x.x
git --version
docker compose version
docker run hello-world    # 确认 Docker 可用
```

---



## 安装步骤



### 方式 A：本地开发（Docker 跑 DB/Redis，本机跑 API/Web）

适合日常开发，热重载最快。

```bash
# 1. 克隆并安装依赖
git clone https://github.com/etianwang/OverBuild
cd OverBuild
npm install

# 2. 配置环境变量
cp .env.example .env
# 按需编辑 .env（见下方「环境变量」）

# 3. 启动 PostgreSQL + Redis，并初始化数据库
npm run docker:init
# 等价于：docker compose up -d → prisma migrate deploy → prisma db seed

# 4. 启动开发服务（两个终端）
npm run dev:api   # http://localhost:3001
npm run dev:web   # http://localhost:3000
```

**访问地址**


| 服务         | 地址                                                                         |
| ---------- | -------------------------------------------------------------------------- |
| 前端         | [http://localhost:3000](http://localhost:3000)                             |
| API 健康检查   | [http://localhost:3001/api/v1/health](http://localhost:3001/api/v1/health) |
| Swagger 文档 | [http://localhost:3001/api/docs](http://localhost:3001/api/docs)           |


---



### 方式 B：全栈 Docker（API + Web + DB + Redis 全在容器内）

适合快速体验完整系统，无需本机启动 Node 开发服务。

```bash
git clone <repo-url> OverBuild
cd OverBuild
npm install
cp .env.example .env

# 一键启动（推荐）
npm run docker:full
```


| 服务      | 地址                                                                         |
| ------- | -------------------------------------------------------------------------- |
| 前端      | [http://localhost:3000](http://localhost:3000)                             |
| API     | [http://localhost:3001/api/v1/health](http://localhost:3001/api/v1/health) |
| Swagger | [http://localhost:3001/api/docs](http://localhost:3001/api/docs)           |


---



### 方式 C：生产部署（Ubuntu + 宝塔面板 + Docker）

默认生产方案：**宝塔面板**管理 Nginx / SSL / 防火墙，**Docker Compose** 运行应用与数据库。

#### 1. 宝塔面板准备

在宝塔「软件商店」安装：


| 软件             | 说明                                                                     |
| -------------- | ---------------------------------------------------------------------- |
| **Nginx**      | 反向代理与 HTTPS（通常默认已装）                                                    |
| **Docker 管理器** | 或按 [Docker 官方文档](https://docs.docker.com/engine/install/ubuntu/) 命令行安装 |


> 无需在宝塔安装 PostgreSQL / Redis，它们运行在 Docker 容器内。



#### 2. 部署项目

```bash
# 建议目录（与宝塔网站目录一致）
cd /www/wwwroot
git clone <repo-url> overbuild
cd overbuild

cp .env.docker.example .env
```

编辑 `.env`（必改项）：

```bash
JWT_SECRET=你的长随机串
JWT_REFRESH_SECRET=你的长随机串
CORS_ORIGIN=https://你的域名
NEXT_PUBLIC_API_URL=/api/v1
DATA_DIR=/www/wwwroot/overbuild/data
```

启动：

```bash
bash scripts/deploy-prod.sh

# 或手动：
mkdir -p /www/wwwroot/overbuild/data/{postgres,redis,uploads}
docker compose up -d --build
docker compose exec api sh -c 'cd /app && npx prisma db seed'
```

> **不要用** `docker compose --profile prod`：会与宝塔 Nginx 争抢 80 端口。



#### 3. 宝塔配置站点与 SSL

1. **网站** → **添加站点** → 填写域名
2. **网站** → 你的站点 → **SSL** → **Let's Encrypt** 申请证书并开启强制 HTTPS
3. **网站** → 你的站点 → **配置文件** → 在 `server { }` 内粘贴 `[deploy/baota/nginx-site.conf](deploy/baota/nginx-site.conf)` 内容
4. **安全** → **防火墙**：仅开放 **80、443、22**；**不要**对外开放 3000、3001、5432、6379



#### 4. 验证

```bash
# 服务器本机
curl http://127.0.0.1:3001/api/v1/health

# 浏览器
https://你的域名
# 登录 admin / admin123（上线后立即修改密码）
```



#### 备选：无宝塔时

若服务器未装宝塔，可用 Compose 内置 Nginx：

```bash
docker compose --profile prod up -d --build
```

配置文件见 `[deploy/nginx/overbuild-docker.conf](deploy/nginx/overbuild-docker.conf)`。

---



## 环境变量

开发环境复制 `.env.example` → `.env`；生产 Docker 复制 `.env.docker.example` → `.env`。

### 必须配置（生产）


| 变量                   | 说明                                 | 开发默认值                             |
| -------------------- | ---------------------------------- | --------------------------------- |
| `JWT_SECRET`         | 访问令牌签名密钥，**生产必须改为长随机串**            | `change-me-in-production`         |
| `JWT_REFRESH_SECRET` | 刷新令牌签名密钥，**生产必须修改**                | `change-me-refresh-in-production` |
| `CORS_ORIGIN`        | 允许跨域的前端地址（全栈 Docker 时由 compose 注入） | `http://localhost:3000`           |




### 数据库与缓存


| 变量             | 说明                                        | 默认值                                                             |
| -------------- | ----------------------------------------- | --------------------------------------------------------------- |
| `DATABASE_URL` | PostgreSQL 连接串（须含 `client_encoding=UTF8`） | `postgresql://overbuild:overbuild@localhost:5432/overbuild?...` |
| `REDIS_URL`    | Redis 连接地址                                | `redis://localhost:6379`                                        |


Docker Compose 内部网络下，API 容器会自动使用 `db` / `redis` 主机名，无需改 `DATABASE_URL`。

### API / 前端


| 变量                       | 说明                                   | 默认值                            |
| ------------------------ | ------------------------------------ | ------------------------------ |
| `API_PORT`               | API 监听端口                             | `3001`                         |
| `API_URL`                | API 基址（服务端用）                         | `http://localhost:3001`        |
| `NEXT_PUBLIC_API_URL`    | 前端请求 API 的地址；生产走 Nginx 时设为 `/api/v1` | `http://localhost:3001/api/v1` |
| `JWT_EXPIRES_IN`         | 访问令牌有效期                              | `2h`                           |
| `JWT_REFRESH_EXPIRES_IN` | 刷新令牌有效期                              | `7d`                           |




### 可选


| 变量               | 说明                                               |
| ---------------- | ------------------------------------------------ |
| `DATA_DIR`       | 数据持久化目录（PostgreSQL / Redis / 上传文件）               |
| `DEEPL_AUTH_KEY` | DeepL 翻译 API Key（Free 版以 `:fx` 结尾）；留空则使用 mock 翻译 |
| `DEEPL_API_URL`  | DeepL API 地址覆盖（一般无需设置）                           |
| `POSTGRES_PORT`  | Docker 映射 PostgreSQL 到本机的端口                      |
| `REDIS_PORT`     | Docker 映射 Redis 到本机的端口                           |
| `WEB_PORT`       | Docker 映射 Web 到本机的端口                             |
| `HTTP_PORT`      | 生产 Nginx 对外端口                                    |


验证 DeepL：`npm run test:deepl`（需在 `.env` 中配置 `DEEPL_AUTH_KEY`）。

---



## 默认账号与密码

> **安全提示**：以下为 `prisma db seed` 写入的演示账号，**生产环境部署后请立即修改管理员密码**，并更换 JWT 密钥。



### 应用登录（Web 界面）


| 用户名           | 密码         | 角色        |
| ------------- | ---------- | --------- |
| `admin`       | `admin123` | 管理员（全部权限） |
| `pm`          | `demo123`  | 项目经理      |
| `finance`     | `demo123`  | 财务        |
| `boss`        | `demo123`  | 老板        |
| `procurement` | `demo123`  | 采购        |
| `warehouse`   | `demo123`  | 仓库管理员     |
| `translator`  | `demo123`  | 翻译        |


管理员邮箱（演示）：`admin@overbuild.local`

### Docker 内置 PostgreSQL（仅数据库连接用）


| 项        | 值                             |
| -------- | ----------------------------- |
| 用户名      | `overbuild`                   |
| 密码       | `overbuild`                   |
| 数据库名     | `overbuild`                   |
| 主机（容器内）  | `db`                          |
| 主机（本机连接） | `localhost`                   |
| 端口       | `5432`（可用 `POSTGRES_PORT` 修改） |


连接串示例（本机连 Docker 中的库）：

```
postgresql://overbuild:overbuild@localhost:5432/overbuild?schema=public&client_encoding=UTF8
```

---



## Docker 数据持久化

项目只有 **一个** `[docker-compose.yml](docker-compose.yml)`。你只需在 `.env` 里设置 `DATA_DIR`，不用改 compose 文件。

### 怎么设置存放位置

在 `.env` 中指定目录即可：

```bash
# 开发（默认，相对项目根目录）
DATA_DIR=./data

# 生产（宝塔，推荐绝对路径）
DATA_DIR=/www/wwwroot/overbuild/data
```

启动时 Docker 会把数据写到对应子目录：


| 宿主机路径                  | 内容             |
| ---------------------- | -------------- |
| `${DATA_DIR}/postgres` | PostgreSQL 数据库 |
| `${DATA_DIR}/redis`    | Redis 数据       |
| `${DATA_DIR}/uploads`  | 上传的文档、图纸       |


`docker-compose.yml` 中的挂载写法（无需手动改）：

```yaml
volumes:
  - ${DATA_DIR:-./data}/postgres:/var/lib/postgresql/data
  - ${DATA_DIR:-./data}/redis:/data
  - ${DATA_DIR:-./data}/uploads:/app/apps/api/uploads
```

> `docker compose down` 只停容器，**不删** `${DATA_DIR}` 里的文件。清空数据需手动 `rm -rf` 该目录。



### 为什么只有一个 compose 文件？

之前拆成多个文件是为了叠加不同场景，现已合并：


| 以前                                  | 现在                                 |
| ----------------------------------- | ---------------------------------- |
| `docker-compose.data.yml`（数据目录）     | 合并进主文件，用 `DATA_DIR` 环境变量           |
| `docker-compose.prod.yml`（生产 Nginx） | 合并进主文件，用 `--profile prod` 启用 Nginx |


**开发启动**（直接访问 3000 / 3001）：

```bash
docker compose up -d --build
```

**生产启动（宝塔，默认）** — Docker 跑应用，宝塔 Nginx 反代：

```bash
docker compose up -d --build
# 或：bash scripts/deploy-prod.sh
```

**生产启动（无宝塔备选）** — Compose 内置 Nginx：

```bash
docker compose --profile prod up -d --build
```

生产 `.env` 须设置 `CORS_ORIGIN`、`NEXT_PUBLIC_API_URL=/api/v1`（见 `.env.docker.example`）。

### 一键启动

```bash
cp .env.example .env
npm run docker:full
```

启动后访问：


| 服务       | 地址                                                                         |
| -------- | -------------------------------------------------------------------------- |
| 前端       | [http://localhost:3000](http://localhost:3000)                             |
| API 健康检查 | [http://localhost:3001/api/v1/health](http://localhost:3001/api/v1/health) |
| Swagger  | [http://localhost:3001/api/docs](http://localhost:3001/api/docs)           |


方式 A 本地开发（`npm run dev:api`）时，上传文件在 `apps/api/uploads/`（不走 Docker）。

### 常用操作

```bash
npm run docker:up          # 仅 db + redis
docker compose up -d       # 全栈
npm run docker:down        # 停止容器（数据仍在 DATA_DIR）
docker compose down

ls -la ./data/             # 查看本地数据（默认 DATA_DIR）
du -sh /www/wwwroot/overbuild/data  # 宝塔生产数据占用
```



### 备份

```bash
# 直接打包 DATA_DIR（推荐）
tar czf overbuild-data.tar.gz -C "${DATA_DIR:-./data}" .

# 或仅导出数据库 SQL
docker compose exec -T db pg_dump -U overbuild overbuild > backup.sql
```



### 恢复

```bash
docker compose stop api web
cat backup.sql | docker compose exec -T db psql -U overbuild -d overbuild
docker compose start api web

# 或解压整个 DATA_DIR 备份
tar xzf overbuild-data.tar.gz -C "${DATA_DIR:-./data}"
```



### 清空数据（不可恢复）

```bash
docker compose down
rm -rf "${DATA_DIR:-./data}"
mkdir -p "${DATA_DIR:-./data}"/{postgres,redis,uploads}
docker compose up -d --build
docker compose exec api sh -c 'cd /app && npx prisma migrate deploy && npx prisma db seed'
```



### 端口被占用

```bash
export POSTGRES_PORT=5433
docker compose up -d
```

同时将 `.env` 中 `DATABASE_URL` 的端口改为 `5433`，再执行 `npm run db:setup`。

---



## 常用命令


| 命令                         | 说明                             |
| -------------------------- | ------------------------------ |
| `npm run dev:api`          | 启动 API 开发服务（方式 A）              |
| `npm run dev:web`          | 启动 Web 开发服务（方式 A）              |
| `npm run docker:up`        | 启动 db + redis                  |
| `npm run docker:full`      | 一键全栈启动（构建 + 迁移 + seed）         |
| `npm run docker:down`      | 停止容器（数据仍在 DATA_DIR）            |
| `npm run docker:init`      | 启动 db + redis + migrate + seed |
| `npm run docker:build`     | 构建 Docker 镜像                   |
| `npm run docker:prod`      | 无宝塔备选：Compose 内置 Nginx         |
| `npm run docker:prod:down` | 停止生产栈                          |
| `npm run db:setup`         | migrate deploy + seed          |
| `npm run db:migrate`       | 开发环境迁移（`migrate dev`）          |
| `npm run db:seed`          | 写入演示数据                         |
| `npm run lint`             | ESLint                         |
| `npm run build`            | 构建 API + Web                   |
| `npm run test`             | 单元测试                           |
| `npm run test:e2e`         | API E2E 测试                     |
| `npm run test:deepl`       | 验证 DeepL API Key               |


本地完整验收（lint / build / test / Docker 冒烟）：

```bash
npm run lint && npm run build && npm run test && npm run test:e2e
docker compose config && docker compose --profile prod config
docker compose up -d --build
docker compose exec api sh -c 'cd /app && npx prisma db seed'
curl -sf http://localhost:3001/api/v1/health
```

---



## 文档

详细设计见 `docs/` 目录，模块实现顺序见 `TASKS.md`。