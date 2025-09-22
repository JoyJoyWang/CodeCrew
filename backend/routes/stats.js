import express from 'express';
import DailyStats from '../models/DailyStats.js';
import Group from '../models/Group.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// 上报今日解题数据
router.post('/report', authenticateToken, async (req, res) => {
  try {
    const { groupId, solvedCount, solvedQuestions, dataSource = 'recent_submissions' } = req.body;
    
    if (!groupId) {
      return res.status(400).json({ error: '缺少组ID' });
    }

    // 验证用户是否在组中
    const group = await Group.findOne({
      _id: groupId,
      'members.user': req.user._id,
      'members.isActive': true
    });

    if (!group) {
      return res.status(404).json({ error: '组不存在或您不在该组中' });
    }

    const today = new Date().toISOString().split('T')[0];

    // 查找或创建今日统计
    let dailyStat = await DailyStats.findOne({
      user: req.user._id,
      group: groupId,
      date: today
    });

    if (dailyStat) {
      // 更新现有记录
      dailyStat.solvedCount = solvedCount || 0;
      dailyStat.solvedQuestions = solvedQuestions || [];
      dailyStat.dataSource = dataSource;
      dailyStat.updatedAt = new Date();
    } else {
      // 创建新记录
      dailyStat = new DailyStats({
        user: req.user._id,
        group: groupId,
        date: today,
        solvedCount: solvedCount || 0,
        solvedQuestions: solvedQuestions || [],
        dataSource
      });
    }

    await dailyStat.save();

    // 更新组的最后活动时间
    group.stats.lastActivity = new Date();
    await group.save();

    res.json({
      success: true,
      message: '数据上报成功',
      data: {
        date: today,
        solvedCount: dailyStat.solvedCount,
        dataSource: dailyStat.dataSource
      }
    });

  } catch (error) {
    console.error('上报数据错误:', error);
    res.status(500).json({ error: '数据上报失败' });
  }
});

// 获取今日排名
router.get('/today-ranking/:groupId', authenticateToken, async (req, res) => {
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

    const today = new Date().toISOString().split('T')[0];

    const todayStats = await DailyStats.find({
      group: groupId,
      date: today
    })
    .populate('user', 'name avatar leetcodeUsername')
    .sort({ solvedCount: -1 })
    .limit(parseInt(limit));

    const ranking = todayStats.map((stat, index) => ({
      rank: index + 1,
      user: {
        id: stat.user._id,
        name: stat.user.name,
        avatar: stat.user.avatar,
        leetcodeUsername: stat.user.leetcodeUsername
      },
      solvedCount: stat.solvedCount,
      solvedQuestions: stat.solvedQuestions,
      dataSource: stat.dataSource
    }));

    res.json({
      success: true,
      date: today,
      ranking,
      totalMembers: group.stats.totalMembers
    });

  } catch (error) {
    console.error('获取今日排名错误:', error);
    res.status(500).json({ error: '获取排名失败' });
  }
});

// 获取周排名
router.get('/week-ranking/:groupId', authenticateToken, async (req, res) => {
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

    // 计算本周开始日期
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekStartStr = weekStart.toISOString().split('T')[0];

    const weekStats = await DailyStats.find({
      group: groupId,
      date: { $gte: weekStartStr }
    })
    .populate('user', 'name avatar leetcodeUsername');

    // 按用户聚合周数据
    const userStats = {};
    weekStats.forEach(stat => {
      const userId = stat.user._id.toString();
      if (!userStats[userId]) {
        userStats[userId] = {
          user: stat.user,
          totalSolved: 0,
          days: 0,
          dailyStats: []
        };
      }
      userStats[userId].totalSolved += stat.solvedCount;
      userStats[userId].days += 1;
      userStats[userId].dailyStats.push({
        date: stat.date,
        solvedCount: stat.solvedCount
      });
    });

    // 排序并限制数量
    const ranking = Object.values(userStats)
      .sort((a, b) => b.totalSolved - a.totalSolved)
      .slice(0, parseInt(limit))
      .map((stat, index) => ({
        rank: index + 1,
        user: {
          id: stat.user._id,
          name: stat.user.name,
          avatar: stat.user.avatar,
          leetcodeUsername: stat.user.leetcodeUsername
        },
        totalSolved: stat.totalSolved,
        activeDays: stat.days,
        dailyStats: stat.dailyStats
      }));

    res.json({
      success: true,
      weekStart: weekStartStr,
      ranking,
      totalMembers: group.stats.totalMembers
    });

  } catch (error) {
    console.error('获取周排名错误:', error);
    res.status(500).json({ error: '获取周排名失败' });
  }
});

// 获取用户历史数据
router.get('/user-history/:groupId', authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { days = 30 } = req.query;

    // 验证用户是否在组中
    const group = await Group.findOne({
      _id: groupId,
      'members.user': req.user._id,
      'members.isActive': true
    });

    if (!group) {
      return res.status(404).json({ error: '组不存在或您不在该组中' });
    }

    // 计算日期范围
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - parseInt(days));
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    const history = await DailyStats.find({
      user: req.user._id,
      group: groupId,
      date: { $gte: startDateStr, $lte: endDateStr }
    })
    .sort({ date: -1 });

    res.json({
      success: true,
      history: history.map(stat => ({
        date: stat.date,
        solvedCount: stat.solvedCount,
        solvedQuestions: stat.solvedQuestions,
        dataSource: stat.dataSource
      })),
      totalDays: history.length,
      totalSolved: history.reduce((sum, stat) => sum + stat.solvedCount, 0)
    });

  } catch (error) {
    console.error('获取用户历史错误:', error);
    res.status(500).json({ error: '获取历史数据失败' });
  }
});

// 获取组统计概览
router.get('/overview/:groupId', authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;

    // 验证用户是否在组中
    const group = await Group.findOne({
      _id: groupId,
      'members.user': req.user._id,
      'members.isActive': true
    });

    if (!group) {
      return res.status(404).json({ error: '组不存在或您不在该组中' });
    }

    const today = new Date().toISOString().split('T')[0];
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartStr = weekStart.toISOString().split('T')[0];

    // 获取今日和本周数据
    const [todayStats, weekStats] = await Promise.all([
      DailyStats.find({ group: groupId, date: today }),
      DailyStats.find({ group: groupId, date: { $gte: weekStartStr } })
    ]);

    const todayTotal = todayStats.reduce((sum, stat) => sum + stat.solvedCount, 0);
    const weekTotal = weekStats.reduce((sum, stat) => sum + stat.solvedCount, 0);

    // 计算活跃用户数
    const todayActiveUsers = new Set(todayStats.map(stat => stat.user.toString())).size;
    const weekActiveUsers = new Set(weekStats.map(stat => stat.user.toString())).size;

    res.json({
      success: true,
      overview: {
        group: {
          id: group._id,
          name: group.name,
          totalMembers: group.stats.totalMembers
        },
        today: {
          totalSolved: todayTotal,
          activeUsers: todayActiveUsers,
          averagePerUser: todayActiveUsers > 0 ? Math.round(todayTotal / todayActiveUsers * 10) / 10 : 0
        },
        week: {
          totalSolved: weekTotal,
          activeUsers: weekActiveUsers,
          averagePerUser: weekActiveUsers > 0 ? Math.round(weekTotal / weekActiveUsers * 10) / 10 : 0
        }
      }
    });

  } catch (error) {
    console.error('获取组概览错误:', error);
    res.status(500).json({ error: '获取概览失败' });
  }
});

export default router;
