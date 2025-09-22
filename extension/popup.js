/* global chrome */

// 配置
const API_BASE_URL = 'http://localhost:3000/api';
const GOOGLE_CLIENT_ID = 'your-google-client-id.apps.googleusercontent.com'; // 需要替换为实际的客户端ID

// 状态管理
let currentUser = null;
let currentGroup = null;
let authToken = null;

// DOM 元素
const elements = {
  loginSection: document.getElementById('login-section'),
  mainContent: document.getElementById('main-content'),
  loginStatus: document.getElementById('login-status'),
  googleLoginBtn: document.getElementById('google-login-btn'),
  todayCount: document.getElementById('today-count'),
  dataSource: document.getElementById('data-source'),
  recentList: document.getElementById('recent-list'),
  groupInfo: document.getElementById('group-info'),
  noGroup: document.getElementById('no-group'),
  groupForms: document.getElementById('group-forms'),
  rankingContent: document.getElementById('ranking-content')
};

// API 调用
const api = {
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` })
      },
      ...options
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '请求失败');
      }
      
      return data;
    } catch (error) {
      console.error('API 请求失败:', error);
      throw error;
    }
  },

  // 认证相关
  async googleLogin(token) {
    return this.request('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ token })
    });
  },

  async getMe() {
    return this.request('/auth/me');
  },

  async bindLeetCode(username) {
    return this.request('/auth/bind-leetcode', {
      method: 'POST',
      body: JSON.stringify({ leetcodeUsername: username })
    });
  },

  // 组相关
  async createGroup(name, description) {
    return this.request('/groups', {
      method: 'POST',
      body: JSON.stringify({ name, description })
    });
  },

  async joinGroup(inviteCode) {
    return this.request('/groups/join', {
      method: 'POST',
      body: JSON.stringify({ inviteCode })
    });
  },

  async getMyGroups() {
    return this.request('/groups/my-groups');
  },

  async leaveGroup(groupId) {
    return this.request(`/groups/${groupId}/leave`, {
      method: 'POST'
    });
  },

  // 统计相关
  async reportStats(groupId, stats) {
    return this.request('/stats/report', {
      method: 'POST',
      body: JSON.stringify({ groupId, ...stats })
    });
  },

  async getTodayRanking(groupId) {
    return this.request(`/stats/today-ranking/${groupId}`);
  },

  async getWeekRanking(groupId) {
    return this.request(`/stats/week-ranking/${groupId}`);
  },

  // 提醒相关
  async notifyGroup(groupId, message) {
    return this.request(`/reminders/notify-group/${groupId}`, {
      method: 'POST',
      body: JSON.stringify({ message, type: 'email' })
    });
  }
};

// 工具函数
function showError(message) {
  console.error(message);
  // 可以添加错误提示UI
}

function showSuccess(message) {
  console.log(message);
  // 可以添加成功提示UI
}

function formatTime(timestamp) {
  return new Date(timestamp * 1000).toLocaleTimeString();
}

// 标签页切换
function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  const contents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;
      
      // 更新标签状态
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // 更新内容显示
      contents.forEach(content => {
        content.classList.remove('active');
        if (content.id === `${targetTab}-tab`) {
          content.classList.add('active');
        }
      });

      // 加载对应内容
      if (targetTab === 'ranking') {
        loadRanking();
      }
    });
  });
}

// 渲染统计信息
function renderStats(data) {
  const todayStats = data?.todayStats || {};
  elements.todayCount.textContent = todayStats.count ?? '-';
  
  // 显示数据来源
  const sourceMap = {
    'recent_submissions': '✅ 详细数据',
    'calendar': '📅 日历数据',
    'error': '❌ 获取失败'
  };
  elements.dataSource.textContent = sourceMap[todayStats.source] || '⏳ 加载中...';
  
  // 渲染最近题目
  elements.recentList.innerHTML = '';
  const items = data?.latestSolved ?? [];
  
  if (items.length === 0 && todayStats.source === 'calendar') {
    const div = document.createElement('div');
    div.className = 'item muted';
    div.textContent = '日历模式：仅显示数量，无具体题目';
    elements.recentList.appendChild(div);
  } else {
    items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'item';
      const date = new Date((item.timestamp || 0) * 1000);
      div.textContent = `${item.title || item.titleSlug} · ${date.toLocaleTimeString()}`;
      elements.recentList.appendChild(div);
    });
  }
}

// 渲染组信息
function renderGroupInfo(group) {
  if (group) {
    elements.groupInfo.style.display = 'block';
    elements.noGroup.style.display = 'none';
    elements.groupForms.style.display = 'none';
    
    document.getElementById('group-name').textContent = group.name;
    document.getElementById('group-members').textContent = `${group.members} 名成员`;
  } else {
    elements.groupInfo.style.display = 'none';
    elements.noGroup.style.display = 'block';
    elements.groupForms.style.display = 'none';
  }
}

// 渲染排行榜
function renderRanking(ranking) {
  const content = elements.rankingContent;
  content.innerHTML = '';

  if (!ranking || ranking.length === 0) {
    content.innerHTML = '<div class="muted">暂无排行榜数据</div>';
    return;
  }

  ranking.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = 'ranking-item';
    
    div.innerHTML = `
      <div class="rank">${item.rank}</div>
      <div class="user-info">
        <div class="username">${item.user.name}</div>
        ${item.user.leetcodeUsername ? `<div class="leetcode-username">@${item.user.leetcodeUsername}</div>` : ''}
      </div>
      <div class="solved-count">${item.solvedCount} 题</div>
    `;
    
    content.appendChild(div);
  });
}

// 加载排行榜
async function loadRanking() {
  if (!currentGroup) {
    elements.rankingContent.innerHTML = '<div class="muted">请先加入小组</div>';
    return;
  }

  try {
    elements.rankingContent.innerHTML = '<div class="loading">⏳ 加载排行榜...</div>';
    const data = await api.getTodayRanking(currentGroup.id);
    renderRanking(data.ranking);
  } catch (error) {
    elements.rankingContent.innerHTML = `<div class="error">加载失败: ${error.message}</div>`;
  }
}

// 加载用户数据
async function loadUserData() {
  try {
    const data = await api.getMe();
    currentUser = data.user;
    currentGroup = data.user.currentGroup;
    
    // 显示主要内容
    elements.loginSection.style.display = 'none';
    elements.mainContent.style.display = 'block';
    
    // 渲染组信息
    renderGroupInfo(currentGroup);
    
    // 加载本地缓存的数据
    chrome.runtime.sendMessage({ type: 'GET_CACHE' }, (data) => {
      renderStats(data || {});
      
      // 如果有组且本地有数据，上报到后端
      if (currentGroup && data?.todayStats) {
        reportStatsToBackend(data.todayStats);
      }
    });
    
  } catch (error) {
    console.error('加载用户数据失败:', error);
    elements.loginStatus.textContent = '❌ 加载失败，请重新登录';
    elements.googleLoginBtn.style.display = 'block';
  }
}

// 上报统计数据到后端
async function reportStatsToBackend(stats) {
  if (!currentGroup) return;
  
  try {
    await api.reportStats(currentGroup.id, {
      solvedCount: stats.count,
      solvedQuestions: stats.solved || [],
      dataSource: stats.source
    });
  } catch (error) {
    console.error('上报统计数据失败:', error);
  }
}

// Google 登录
async function handleGoogleLogin() {
  try {
    // 这里需要集成 Google Identity Services
    // 简化版本，实际需要加载 Google 库
    elements.loginStatus.textContent = '⏳ 正在登录...';
    
    // 模拟登录流程
    const mockToken = 'mock-google-token';
    const response = await api.googleLogin(mockToken);
    
    authToken = response.token;
    currentUser = response.user;
    
    // 保存到本地存储
    chrome.storage.local.set({ authToken, currentUser });
    
    await loadUserData();
    
  } catch (error) {
    console.error('Google 登录失败:', error);
    elements.loginStatus.textContent = '❌ 登录失败';
  }
}

// 创建组
async function handleCreateGroup() {
  const name = document.getElementById('group-name-input').value.trim();
  const description = document.getElementById('group-desc-input').value.trim();
  
  if (!name) {
    showError('请输入小组名称');
    return;
  }
  
  try {
    const response = await api.createGroup(name, description);
    currentGroup = response.group;
    renderGroupInfo(currentGroup);
    showSuccess('小组创建成功！');
  } catch (error) {
    showError(`创建失败: ${error.message}`);
  }
}

// 加入组
async function handleJoinGroup() {
  const inviteCode = document.getElementById('invite-code-input').value.trim().toUpperCase();
  
  if (!inviteCode) {
    showError('请输入邀请码');
    return;
  }
  
  try {
    const response = await api.joinGroup(inviteCode);
    currentGroup = response.group;
    renderGroupInfo(currentGroup);
    showSuccess('成功加入小组！');
  } catch (error) {
    showError(`加入失败: ${error.message}`);
  }
}

// 离开组
async function handleLeaveGroup() {
  if (!currentGroup) return;
  
  if (!confirm('确定要离开当前小组吗？')) return;
  
  try {
    await api.leaveGroup(currentGroup.id);
    currentGroup = null;
    renderGroupInfo(null);
    showSuccess('已离开小组');
  } catch (error) {
    showError(`离开失败: ${error.message}`);
  }
}

// 提醒朋友
async function handleRemindFriends() {
  if (!currentGroup) {
    showError('请先加入小组');
    return;
  }
  
  try {
    const response = await api.notifyGroup(currentGroup.id, '快来刷题吧！');
    showSuccess(response.message);
  } catch (error) {
    showError(`提醒失败: ${error.message}`);
  }
}

// 初始化事件监听
function initEventListeners() {
  // Google 登录
  elements.googleLoginBtn.addEventListener('click', handleGoogleLogin);
  
  // 组相关
  document.getElementById('create-group-btn').addEventListener('click', () => {
    elements.groupForms.style.display = 'block';
    document.getElementById('create-group-form').style.display = 'block';
    document.getElementById('join-group-form').style.display = 'none';
  });
  
  document.getElementById('join-group-btn').addEventListener('click', () => {
    elements.groupForms.style.display = 'block';
    document.getElementById('join-group-form').style.display = 'block';
    document.getElementById('create-group-form').style.display = 'none';
  });
  
  document.getElementById('create-group-submit').addEventListener('click', handleCreateGroup);
  document.getElementById('join-group-submit').addEventListener('click', handleJoinGroup);
  document.getElementById('leave-group-btn').addEventListener('click', handleLeaveGroup);
  
  document.getElementById('cancel-create').addEventListener('click', () => {
    elements.groupForms.style.display = 'none';
  });
  
  document.getElementById('cancel-join').addEventListener('click', () => {
    elements.groupForms.style.display = 'none';
  });
  
  // 排行榜相关
  document.getElementById('refresh-ranking-btn').addEventListener('click', loadRanking);
  document.getElementById('remind-friends-btn').addEventListener('click', handleRemindFriends);
}

// 初始化
async function init() {
  try {
    // 检查本地存储的认证信息
    const result = await chrome.storage.local.get(['authToken', 'currentUser']);
    
    if (result.authToken && result.currentUser) {
      authToken = result.authToken;
      currentUser = result.currentUser;
      await loadUserData();
    } else {
      elements.loginStatus.textContent = '请先登录';
      elements.googleLoginBtn.style.display = 'block';
    }
    
    initTabs();
    initEventListeners();
    
  } catch (error) {
    console.error('初始化失败:', error);
    elements.loginStatus.textContent = '❌ 初始化失败';
  }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);