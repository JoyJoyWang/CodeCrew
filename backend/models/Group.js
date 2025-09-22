import mongoose from 'mongoose';

const groupSchema = new mongoose.Schema({
  // 基础信息
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  inviteCode: { type: String, unique: true, required: true },
  
  // 成员管理
  members: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['owner', 'admin', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true }
  }],
  
  // 设置
  settings: {
    isPublic: { type: Boolean, default: false },
    maxMembers: { type: Number, default: 50 },
    allowInvites: { type: Boolean, default: true },
    reminderEnabled: { type: Boolean, default: true }
  },
  
  // 统计信息
  stats: {
    totalMembers: { type: Number, default: 0 },
    totalSolvedToday: { type: Number, default: 0 },
    lastActivity: { type: Date, default: Date.now }
  },
  
  // 时间戳
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 更新时自动设置 updatedAt
groupSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  this.stats.totalMembers = this.members.filter(m => m.isActive).length;
  next();
});

// 索引
groupSchema.index({ inviteCode: 1 });
groupSchema.index({ 'members.user': 1 });
groupSchema.index({ createdAt: -1 });

export default mongoose.model('Group', groupSchema);
