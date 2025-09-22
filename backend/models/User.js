import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  // 基础信息
  googleId: { type: String, unique: true, sparse: true },
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  avatar: { type: String },
  
  // LeetCode 信息
  leetcodeUsername: { type: String, unique: true, sparse: true },
  leetcodeStats: {
    totalSolved: { type: Number, default: 0 },
    easySolved: { type: Number, default: 0 },
    mediumSolved: { type: Number, default: 0 },
    hardSolved: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now }
  },
  
  // 组队信息
  groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
  currentGroup: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
  
  // 设置
  settings: {
    emailNotifications: { type: Boolean, default: true },
    reminderTime: { type: String, default: '20:00' }, // 提醒时间
    timezone: { type: String, default: 'Asia/Shanghai' }
  },
  
  // 时间戳
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 更新时自动设置 updatedAt
userSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// 索引
userSchema.index({ googleId: 1 });
userSchema.index({ email: 1 });
userSchema.index({ leetcodeUsername: 1 });
userSchema.index({ 'groups': 1 });

export default mongoose.model('User', userSchema);
