import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';

// 导入路由
import authRoutes from './routes/auth.js';
import groupRoutes from './routes/groups.js';
import statsRoutes from './routes/stats.js';
import reminderRoutes from './routes/reminders.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 限流
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 限制每个IP 15分钟内最多100个请求
  message: '请求过于频繁，请稍后再试'
});
app.use('/api/', limiter);

// 数据库连接
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/leetcode-squad', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB 连接成功'))
.catch(err => console.error('❌ MongoDB 连接失败:', err));

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/reminders', reminderRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '0.1.0'
  });
});

// 404 处理
app.use('*', (req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ 
    error: process.env.NODE_ENV === 'production' ? '服务器内部错误' : err.message 
  });
});

app.listen(PORT, () => {
  console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
  console.log(`📊 健康检查: http://localhost:${PORT}/api/health`);
});
