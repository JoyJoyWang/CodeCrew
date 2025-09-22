import express from 'express';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Google 登录验证
router.post('/google', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: '缺少 Google 令牌' });
    }

    // 验证 Google 令牌
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    // 查找或创建用户
    let user = await User.findOne({ googleId });
    
    if (!user) {
      // 检查邮箱是否已存在
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        // 如果邮箱已存在但 Google ID 不同，更新 Google ID
        existingUser.googleId = googleId;
        existingUser.avatar = picture;
        await existingUser.save();
        user = existingUser;
      } else {
        // 创建新用户
        user = new User({
          googleId,
          email,
          name,
          avatar: picture
        });
        await user.save();
      }
    } else {
      // 更新用户信息
      user.name = name;
      user.avatar = picture;
      await user.save();
    }

    // 生成 JWT
    const jwtToken = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token: jwtToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        leetcodeUsername: user.leetcodeUsername
      }
    });

  } catch (error) {
    console.error('Google 登录错误:', error);
    res.status(500).json({ error: '登录失败' });
  }
});

// 绑定 LeetCode 用户名
router.post('/bind-leetcode', authenticateToken, async (req, res) => {
  try {
    const { leetcodeUsername } = req.body;
    
    if (!leetcodeUsername) {
      return res.status(400).json({ error: '请输入 LeetCode 用户名' });
    }

    // 检查用户名是否已被绑定
    const existingUser = await User.findOne({ 
      leetcodeUsername,
      _id: { $ne: req.user._id }
    });
    
    if (existingUser) {
      return res.status(400).json({ error: '该 LeetCode 用户名已被绑定' });
    }

    // 更新用户信息
    req.user.leetcodeUsername = leetcodeUsername;
    await req.user.save();

    res.json({
      success: true,
      message: 'LeetCode 用户名绑定成功',
      leetcodeUsername: req.user.leetcodeUsername
    });

  } catch (error) {
    console.error('绑定 LeetCode 错误:', error);
    res.status(500).json({ error: '绑定失败' });
  }
});

// 获取当前用户信息
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('currentGroup', 'name inviteCode')
      .select('-__v');

    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        leetcodeUsername: user.leetcodeUsername,
        leetcodeStats: user.leetcodeStats,
        currentGroup: user.currentGroup,
        settings: user.settings
      }
    });

  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

// 更新用户设置
router.put('/settings', authenticateToken, async (req, res) => {
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
      message: '设置更新成功',
      settings: req.user.settings
    });

  } catch (error) {
    console.error('更新设置错误:', error);
    res.status(500).json({ error: '更新设置失败' });
  }
});

export default router;
