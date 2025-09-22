# LeetCode Squad Chrome 扩展

朋友刷题小组的 Chrome 扩展，支持实时显示刷题进度、排行榜和组队功能。

## 功能特性

### 🏆 核心功能
- **实时统计**：自动采集 LeetCode 今日解题数量
- **组队刷题**：创建或加入刷题小组
- **排行榜**：实时显示组内排名
- **一键提醒**：通过邮件提醒朋友刷题

### 📊 数据采集
- **双重策略**：优先使用详细提交数据，降级到日历数据
- **自动刷新**：每5分钟后台更新，页面聚焦时刷新
- **隐私保护**：不存储用户 Cookie，仅上传统计结果

### 🎯 用户体验
- **多标签页**：统计、小组、排行榜分离
- **实时反馈**：数据来源标识，错误状态显示
- **响应式设计**：适配不同屏幕尺寸

## 安装使用

### 1. 开发环境安装

1. 下载或克隆项目到本地
2. 打开 Chrome 浏览器
3. 访问 `chrome://extensions/`
4. 开启"开发者模式"
5. 点击"加载已解压的扩展程序"
6. 选择 `extension` 文件夹

### 2. 配置后端服务

确保后端服务正在运行（参考 `backend/README.md`）：

```bash
cd backend
npm install
npm run dev
```

### 3. 配置扩展

编辑 `extension/popup.js`，更新以下配置：

```javascript
const API_BASE_URL = 'http://localhost:3000/api'; // 后端服务地址
const GOOGLE_CLIENT_ID = 'your-google-client-id.apps.googleusercontent.com'; // Google OAuth 客户端ID
```

### 4. 使用步骤

1. 打开 LeetCode 网站并登录
2. 点击扩展图标
3. 使用 Google 账号登录
4. 绑定 LeetCode 用户名
5. 创建或加入刷题小组
6. 查看实时排行榜和统计

## 文件结构

```
extension/
├── manifest.json          # 扩展清单文件
├── background.js          # 后台服务脚本
├── content.js            # 内容脚本（数据采集）
├── popup.html            # 弹窗页面
├── popup.js              # 弹窗逻辑
├── icons/                # 图标文件
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md             # 说明文档
```

## 技术实现

### 数据采集策略

#### 策略1：详细提交数据（推荐）
- 查询 `recentSubmissionList` GraphQL 接口
- 按题目去重统计今日通过数量
- 获取具体题目信息和时间戳
- 数据最准确但依赖用户登录状态

#### 策略2：日历数据（降级）
- 查询 `userCalendar` GraphQL 接口
- 获取每日提交计数
- 稳定性更好但信息较少
- 作为主要策略失败时的备选

### 权限配置

```json
{
  "permissions": ["storage", "alarms"],
  "host_permissions": [
    "https://leetcode.com/*",
    "https://leetcode.cn/*"
  ]
}
```

- `storage`：本地缓存统计数据
- `alarms`：定时刷新任务
- `host_permissions`：仅在 LeetCode 域名下运行

### 数据流程

1. **采集**：content script 在 LeetCode 页面运行
2. **缓存**：数据存储到 Chrome 本地存储
3. **上报**：popup 将数据发送到后端 API
4. **展示**：实时显示统计和排行榜

## 开发指南

### 本地开发

1. 修改代码后刷新扩展
2. 查看控制台日志调试
3. 使用 Chrome DevTools 检查 popup

### 调试技巧

```javascript
// 查看采集的数据
chrome.storage.local.get(['todayStats', 'latestSolved'], console.log);

// 手动触发刷新
chrome.runtime.sendMessage({ type: 'REFRESH_STATS' });

// 查看 API 调用
// 在 popup 中打开 DevTools
```

### 常见问题

#### 1. 数据采集失败
- 检查是否在 LeetCode 页面
- 确认用户已登录 LeetCode
- 查看控制台错误信息
- 尝试手动刷新页面

#### 2. 后端连接失败
- 确认后端服务正在运行
- 检查 API_BASE_URL 配置
- 查看网络请求错误

#### 3. Google 登录失败
- 确认 GOOGLE_CLIENT_ID 配置
- 检查 Google OAuth 设置
- 查看浏览器控制台错误

## 部署发布

### 准备发布

1. 更新 `manifest.json` 版本号
2. 准备不同尺寸的图标文件
3. 测试所有功能正常工作
4. 压缩扩展文件夹

### Chrome Web Store 发布

1. 访问 [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
2. 上传扩展包
3. 填写商店信息
4. 提交审核

## 隐私说明

### 数据收集
- 仅收集用户明确授权的 LeetCode 公开数据
- 不存储用户密码或敏感信息
- 统计数据用于排行榜展示

### 数据使用
- 解题数据仅用于组内排名
- 不向第三方分享用户数据
- 用户可随时删除数据

### 合规性
- 遵循 Chrome 扩展政策
- 不干扰 LeetCode 网站功能
- 提供数据删除选项

## 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 创建 Pull Request

## 许可证

MIT License

## 更新日志

### v0.1.0
- 初始版本发布
- 基础数据采集功能
- 组队和排行榜功能
- 邮件提醒功能
