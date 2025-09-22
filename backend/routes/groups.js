import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import Group from '../models/Group.js';
import User from '../models/User.js';
import DailyStats from '../models/DailyStats.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// 创建组
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, description, isPublic = false, maxMembers = 50 } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: '组名不能为空' });
    }

    // 生成邀请码
    const inviteCode = uuidv4().substring(0, 8).toUpperCase();

    // 创建组
    const group = new Group({
      name,
      description,
      inviteCode,
      settings: {
        isPublic,
        maxMembers,
        allowInvites: true
      },
      members: [{
        user: req.user._id,
        role: 'owner',
        joinedAt: new Date(),
        isActive: true
      }]
    });

    await group.save();

    // 更新用户的当前组
    req.user.currentGroup = group._id;
    req.user.groups.push(group._id);
    await req.user.save();

    res.status(201).json({
      success: true,
      group: {
        id: group._id,
        name: group.name,
        description: group.description,
        inviteCode: group.inviteCode,
        settings: group.settings,
        members: group.members.length,
        createdAt: group.createdAt
      }
    });

  } catch (error) {
    console.error('创建组错误:', error);
    res.status(500).json({ error: '创建组失败' });
  }
});

// 通过邀请码加入组
router.post('/join', authenticateToken, async (req, res) => {
  try {
    const { inviteCode } = req.body;
    
    if (!inviteCode) {
      return res.status(400).json({ error: '请输入邀请码' });
    }

    // 查找组
    const group = await Group.findOne({ inviteCode });
    if (!group) {
      return res.status(404).json({ error: '邀请码无效' });
    }

    // 检查是否已在组中
    const existingMember = group.members.find(
      member => member.user.toString() === req.user._id.toString()
    );
    
    if (existingMember) {
      if (existingMember.isActive) {
        return res.status(400).json({ error: '您已在该组中' });
      } else {
        // 重新激活
        existingMember.isActive = true;
        existingMember.joinedAt = new Date();
      }
    } else {
      // 检查组成员数量限制
      if (group.members.filter(m => m.isActive).length >= group.settings.maxMembers) {
        return res.status(400).json({ error: '组已满员' });
      }

      // 添加新成员
      group.members.push({
        user: req.user._id,
        role: 'member',
        joinedAt: new Date(),
        isActive: true
      });
    }

    await group.save();

    // 更新用户的当前组
    req.user.currentGroup = group._id;
    if (!req.user.groups.includes(group._id)) {
      req.user.groups.push(group._id);
    }
    await req.user.save();

    res.json({
      success: true,
      message: '成功加入组',
      group: {
        id: group._id,
        name: group.name,
        description: group.description,
        inviteCode: group.inviteCode,
        members: group.members.filter(m => m.isActive).length
      }
    });

  } catch (error) {
    console.error('加入组错误:', error);
    res.status(500).json({ error: '加入组失败' });
  }
});

// 获取当前用户的组信息
router.get('/my-groups', authenticateToken, async (req, res) => {
  try {
    const groups = await Group.find({
      'members.user': req.user._id,
      'members.isActive': true
    })
    .populate('members.user', 'name avatar leetcodeUsername leetcodeStats')
    .select('-__v')
    .sort({ updatedAt: -1 });

    const groupsWithStats = await Promise.all(
      groups.map(async (group) => {
        // 获取今日排名
        const today = new Date().toISOString().split('T')[0];
        const todayStats = await DailyStats.find({
          group: group._id,
          date: today
        })
        .populate('user', 'name leetcodeUsername')
        .sort({ solvedCount: -1 });

        return {
          id: group._id,
          name: group.name,
          description: group.description,
          inviteCode: group.inviteCode,
          settings: group.settings,
          members: group.members.filter(m => m.isActive).map(member => ({
            id: member.user._id,
            name: member.user.name,
            avatar: member.user.avatar,
            leetcodeUsername: member.user.leetcodeUsername,
            leetcodeStats: member.user.leetcodeStats,
            role: member.role,
            joinedAt: member.joinedAt
          })),
          todayRanking: todayStats.map((stat, index) => ({
            rank: index + 1,
            user: stat.user,
            solvedCount: stat.solvedCount
          })),
          stats: group.stats,
          createdAt: group.createdAt
        };
      })
    );

    res.json({
      success: true,
      groups: groupsWithStats
    });

  } catch (error) {
    console.error('获取组信息错误:', error);
    res.status(500).json({ error: '获取组信息失败' });
  }
});

// 获取组详情
router.get('/:groupId', authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    
    const group = await Group.findOne({
      _id: groupId,
      'members.user': req.user._id,
      'members.isActive': true
    })
    .populate('members.user', 'name avatar leetcodeUsername leetcodeStats')
    .select('-__v');

    if (!group) {
      return res.status(404).json({ error: '组不存在或您不在该组中' });
    }

    // 获取今日和本周排名
    const today = new Date().toISOString().split('T')[0];
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartStr = weekStart.toISOString().split('T')[0];

    const [todayStats, weekStats] = await Promise.all([
      DailyStats.find({
        group: groupId,
        date: today
      })
      .populate('user', 'name leetcodeUsername')
      .sort({ solvedCount: -1 }),
      
      DailyStats.find({
        group: groupId,
        date: { $gte: weekStartStr }
      })
      .populate('user', 'name leetcodeUsername')
      .sort({ solvedCount: -1 })
    ]);

    // 计算周排名（按总解题数）
    const weekRanking = weekStats.reduce((acc, stat) => {
      const userId = stat.user._id.toString();
      if (!acc[userId]) {
        acc[userId] = { user: stat.user, totalSolved: 0 };
      }
      acc[userId].totalSolved += stat.solvedCount;
      return acc;
    }, {});

    const weekRankingArray = Object.values(weekRanking)
      .sort((a, b) => b.totalSolved - a.totalSolved)
      .map((item, index) => ({
        rank: index + 1,
        user: item.user,
        totalSolved: item.totalSolved
      }));

    res.json({
      success: true,
      group: {
        id: group._id,
        name: group.name,
        description: group.description,
        inviteCode: group.inviteCode,
        settings: group.settings,
        members: group.members.filter(m => m.isActive).map(member => ({
          id: member.user._id,
          name: member.user.name,
          avatar: member.user.avatar,
          leetcodeUsername: member.user.leetcodeUsername,
          leetcodeStats: member.user.leetcodeStats,
          role: member.role,
          joinedAt: member.joinedAt
        })),
        todayRanking: todayStats.map((stat, index) => ({
          rank: index + 1,
          user: stat.user,
          solvedCount: stat.solvedCount
        })),
        weekRanking: weekRankingArray,
        stats: group.stats,
        createdAt: group.createdAt
      }
    });

  } catch (error) {
    console.error('获取组详情错误:', error);
    res.status(500).json({ error: '获取组详情失败' });
  }
});

// 离开组
router.post('/:groupId/leave', authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    
    const group = await Group.findOne({
      _id: groupId,
      'members.user': req.user._id
    });

    if (!group) {
      return res.status(404).json({ error: '组不存在或您不在该组中' });
    }

    // 检查是否是组主
    const member = group.members.find(m => m.user.toString() === req.user._id.toString());
    if (member.role === 'owner') {
      return res.status(400).json({ error: '组主不能离开组，请先转让组主权限' });
    }

    // 标记为不活跃
    member.isActive = false;
    await group.save();

    // 更新用户的当前组
    if (req.user.currentGroup?.toString() === groupId) {
      req.user.currentGroup = null;
      await req.user.save();
    }

    res.json({
      success: true,
      message: '已离开组'
    });

  } catch (error) {
    console.error('离开组错误:', error);
    res.status(500).json({ error: '离开组失败' });
  }
});

export default router;
