import express from 'express';
import nodemailer from 'nodemailer';
import Group from '../models/Group.js';
import User from '../models/User.js';
import DailyStats from '../models/DailyStats.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// 配置邮件发送器 (SendGrid)
const createTransporter = () => {
  if (process.env.SENDGRID_API_KEY) {
    return nodemailer.createTransporter({
      service: 'SendGrid',
      auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY
      }
    });
  }
  
  // 开发环境使用控制台输出
  return nodemailer.createTransporter({
    streamTransport: true,
    newline: 'unix',
    buffer: true
  });
};

// 发送提醒邮件
const sendReminderEmail = async (to, groupName, reminderData) => {
  const transporter = createTransporter();
  
  const mailOptions = {
    from: process.env.FROM_EMAIL || 'noreply@leetcode-squad.com',
    to,
    subject: `📚 ${groupName} - 刷题提醒`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ff6b35;">🏆 ${groupName} 刷题小组</h2>
        <p>你好！</p>
        <p>今天还没有刷题吗？快来和朋友们一起刷题吧！</p>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #333; margin-top: 0;">📊 今日排行榜</h3>
          ${reminderData.ranking.map((item, index) => `
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee;">
              <span style="font-weight: ${index < 3 ? 'bold' : 'normal'}; color: ${index === 0 ? '#ff6b35' : index === 1 ? '#ffa726' : index === 2 ? '#ffcc02' : '#666'};">
                ${index + 1}. ${item.user.name} ${item.user.leetcodeUsername ? `(@${item.user.leetcodeUsername})` : ''}
              </span>
              <span style="color: #4caf50; font-weight: bold;">${item.solvedCount} 题</span>
            </div>
          `).join('')}
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://leetcode.com" 
             style="background: #ff6b35; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            🚀 立即开始刷题
          </a>
        </div>
        
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          此邮件由 LeetCode Squad 扩展发送。如不想接收提醒，请在扩展设置中关闭邮件通知。
        </p>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('邮件发送成功:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('邮件发送失败:', error);
    return { success: false, error: error.message };
  }
};

// 一键提醒组内成员
router.post('/notify-group/:groupId', authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { message, type = 'email' } = req.body;

    // 验证用户是否在组中且有权限
    const group = await Group.findOne({
      _id: groupId,
      'members.user': req.user._id,
      'members.isActive': true
    });

    if (!group) {
      return res.status(404).json({ error: '组不存在或您不在该组中' });
    }

    // 检查权限（只有组主和管理员可以发送提醒）
    const member = group.members.find(m => m.user.toString() === req.user._id.toString());
    if (!['owner', 'admin'].includes(member.role)) {
      return res.status(403).json({ error: '只有组主和管理员可以发送提醒' });
    }

    // 获取今日排名数据
    const today = new Date().toISOString().split('T')[0];
    const todayStats = await DailyStats.find({
      group: groupId,
      date: today
    })
    .populate('user', 'name email leetcodeUsername settings')
    .sort({ solvedCount: -1 })
    .limit(10);

    const ranking = todayStats.map((stat, index) => ({
      rank: index + 1,
      user: {
        name: stat.user.name,
        leetcodeUsername: stat.user.leetcodeUsername
      },
      solvedCount: stat.solvedCount
    }));

    // 获取需要提醒的成员（今日未刷题且开启邮件通知）
    const membersToNotify = group.members
      .filter(member => member.isActive)
      .map(member => member.user);

    const usersToNotify = await User.find({
      _id: { $in: membersToNotify },
      'settings.emailNotifications': true
    });

    // 过滤掉今日已刷题的用户
    const todaySolvedUserIds = new Set(todayStats.map(stat => stat.user._id.toString()));
    const usersNeedingReminder = usersToNotify.filter(user => 
      !todaySolvedUserIds.has(user._id.toString())
    );

    const reminderData = {
      groupName: group.name,
      ranking,
      totalMembers: group.stats.totalMembers,
      activeToday: todayStats.length
    };

    // 发送提醒
    const results = [];
    for (const user of usersNeedingReminder) {
      if (type === 'email' && user.email) {
        const result = await sendReminderEmail(user.email, group.name, reminderData);
        results.push({
          user: user.name,
          email: user.email,
          success: result.success,
          error: result.error
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;

    res.json({
      success: true,
      message: `提醒发送完成：成功 ${successCount} 人，失败 ${failCount} 人`,
      results,
      reminderData: {
        groupName: group.name,
        totalMembers: group.stats.totalMembers,
        activeToday: todayStats.length,
        notified: results.length
      }
    });

  } catch (error) {
    console.error('发送提醒错误:', error);
    res.status(500).json({ error: '发送提醒失败' });
  }
});

// 获取提醒历史
router.get('/history/:groupId', authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { limit = 20 } = req.query;

    // 验证用户是否在组中
    const group = await Group.findOne({
      _id: groupId,
      'members.user': req.user._id,
      'members.isActive': true
    });

    if (!group) {
      return res.status(404).json({ error: '组不存在或您不在该组中' });
    }

    // 这里可以添加提醒历史记录的逻辑
    // 目前返回空数组，后续可以添加 ReminderHistory 模型
    res.json({
      success: true,
      history: [],
      message: '提醒历史功能开发中'
    });

  } catch (error) {
    console.error('获取提醒历史错误:', error);
    res.status(500).json({ error: '获取提醒历史失败' });
  }
});

// 设置提醒偏好
router.put('/preferences', authenticateToken, async (req, res) => {
  try {
    const { emailNotifications, reminderTime, timezone } = req.body;

    if (emailNotifications !== undefined) {
      req.user.settings.emailNotifications = emailNotifications;
    }
    if (reminderTime) {
      req.user.settings.reminderTime = reminderTime;
    }
    if (timezone) {
      req.user.settings.timezone = timezone;
    }

    await req.user.save();

    res.json({
      success: true,
      message: '提醒偏好更新成功',
      preferences: {
        emailNotifications: req.user.settings.emailNotifications,
        reminderTime: req.user.settings.reminderTime,
        timezone: req.user.settings.timezone
      }
    });

  } catch (error) {
    console.error('更新提醒偏好错误:', error);
    res.status(500).json({ error: '更新提醒偏好失败' });
  }
});

export default router;
