# LeetCode Squad 后端服务

朋友刷题小组的后端 API 服务，支持用户认证、组队管理、排行榜和提醒功能。

## 快速开始

### 1. 安装依赖

```bash
cd backend
npm install
```

### 2. 配置环境变量

复制 `env.example` 为 `.env` 并填入实际配置：

```bash
cp env.example .env
```

编辑 `.env` 文件，配置以下关键参数：

```env
# 服务器配置
PORT=3000
NODE_ENV=development

# JWT 密钥（必须修改）
JWT_SECRET=your-super-secret-jwt-key-here

# Google OAuth 配置（需要申请）
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# MongoDB 连接
MONGODB_URI=mongodb://localhost:27017/leetcode-squad

# 邮件服务 (可选)
SENDGRID_API_KEY=your-sendgrid-api-key
FROM_EMAIL=noreply@yourdomain.com
```

### 3. 启动 MongoDB

确保 MongoDB 服务正在运行：

```bash
# Windows
net start MongoDB

# macOS/Linux
sudo systemctl start mongod
```

### 4. 启动服务

```bash
# 开发模式（自动重启）
npm run dev

# 生产模式
npm start
```

服务将在 `http://localhost:3000` 启动。

## API 文档

### 认证相关

- `POST /api/auth/google` - Google 登录
- `POST /api/auth/bind-leetcode` - 绑定 LeetCode 用户名
- `GET /api/auth/me` - 获取当前用户信息
- `PUT /api/auth/settings` - 更新用户设置

### 组队管理

- `POST /api/groups` - 创建组
- `POST /api/groups/join` - 加入组（通过邀请码）
- `GET /api/groups/my-groups` - 获取我的组
- `GET /api/groups/:groupId` - 获取组详情
- `POST /api/groups/:groupId/leave` - 离开组

### 统计排行

- `POST /api/stats/report` - 上报解题数据
- `GET /api/stats/today-ranking/:groupId` - 今日排行
- `GET /api/stats/week-ranking/:groupId` - 周排行
- `GET /api/stats/user-history/:groupId` - 用户历史
- `GET /api/stats/overview/:groupId` - 组概览

### 提醒功能

- `POST /api/reminders/notify-group/:groupId` - 一键提醒组员
- `GET /api/reminders/history/:groupId` - 提醒历史
- `PUT /api/reminders/preferences` - 设置提醒偏好

## 数据库模型

### User（用户）
- 基础信息：Google ID、邮箱、姓名、头像
- LeetCode 信息：用户名、统计数据
- 组队信息：所属组、当前组
- 设置：邮件通知、提醒时间、时区

### Group（组）
- 基础信息：名称、描述、邀请码
- 成员管理：用户列表、角色、加入时间
- 设置：公开性、最大成员数、邀请权限
- 统计信息：成员数、今日解题数、最后活动

### DailyStats（每日统计）
- 用户和组关联
- 日期和解题统计
- 具体题目列表
- 排名信息
- 数据来源标识

## 开发说明

### 技术栈
- Node.js + Express
- MongoDB + Mongoose
- JWT 认证
- Google OAuth 2.0
- SendGrid 邮件服务

### 安全考虑
- JWT 令牌认证
- 请求频率限制
- CORS 配置
- 输入验证和清理
- 错误处理

### 扩展性
- 模块化路由设计
- 中间件架构
- 数据库索引优化
- API 版本控制准备

## 部署建议

### 环境要求
- Node.js 16+
- MongoDB 4.4+
- 至少 512MB 内存

### 生产配置
1. 设置强密码的 JWT_SECRET
2. 配置 HTTPS
3. 设置 MongoDB 认证
4. 配置反向代理（Nginx）
5. 设置日志监控
6. 配置备份策略

## 故障排除

### 常见问题

1. **MongoDB 连接失败**
   - 检查 MongoDB 服务是否运行
   - 验证连接字符串格式
   - 检查网络和防火墙设置

2. **Google OAuth 失败**
   - 验证客户端 ID 和密钥
   - 检查重定向 URI 配置
   - 确认 Google 控制台设置

3. **邮件发送失败**
   - 检查 SendGrid API 密钥
   - 验证发件人邮箱
   - 查看 SendGrid 账户状态

### 日志查看
```bash
# 查看服务日志
npm run dev

# 或使用 PM2
pm2 logs leetcode-squad
```

## 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

## 许可证

MIT License
