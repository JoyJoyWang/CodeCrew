import mongoose from 'mongoose';

const dailyStatsSchema = new mongoose.Schema({
  // 用户和组
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  
  // 日期
  date: { type: String, required: true }, // YYYY-MM-DD 格式
  
  // 解题统计
  solvedCount: { type: Number, default: 0 },
  solvedQuestions: [{
    questionId: { type: String, required: true },
    title: { type: String, required: true },
    titleSlug: { type: String, required: true },
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'] },
    solvedAt: { type: Date, required: true }
  }],
  
  // 排名信息
  rank: { type: Number },
  totalGroupMembers: { type: Number },
  
  // 数据来源
  dataSource: { 
    type: String, 
    enum: ['recent_submissions', 'calendar', 'manual'],
    default: 'recent_submissions'
  },
  
  // 时间戳
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 复合索引确保每个用户每天每组只有一条记录
dailyStatsSchema.index({ user: 1, group: 1, date: 1 }, { unique: true });
dailyStatsSchema.index({ group: 1, date: 1, solvedCount: -1 }); // 用于排名查询
dailyStatsSchema.index({ date: -1 });

// 更新时自动设置 updatedAt
dailyStatsSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('DailyStats', dailyStatsSchema);
