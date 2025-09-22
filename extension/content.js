/* global chrome */

const GQL_ENDPOINTS = [
  'https://leetcode.com/graphql',
  'https://leetcode.cn/graphql'
];

async function fetchGraphQL(query, variables = {}) {
  for (const endpoint of GQL_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({ query, variables }),
        credentials: 'include'
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.data) return json.data;
      }
    } catch (e) {
      // ignore and try next endpoint
    }
  }
  throw new Error('GraphQL fetch failed');
}

function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function getTodaySolvedDistinct() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startTs = Math.floor(startOfDay.getTime() / 1000);

  // 策略1: 尝试从最近提交列表获取（更准确）
  try {
    const recentData = await getRecentSubmissions(startTs);
    if (recentData && recentData.length > 0) {
      return {
        dateKey: formatDateKey(startOfDay),
        count: recentData.length,
        solved: recentData,
        source: 'recent_submissions'
      };
    }
  } catch (e) {
    console.warn('Recent submissions failed, trying calendar fallback:', e);
  }

  // 策略2: 降级到提交日历（稳定性更好但信息较少）
  try {
    const calendarData = await getSubmissionCalendar();
    const todayCount = calendarData[formatDateKey(startOfDay)] || 0;
    return {
      dateKey: formatDateKey(startOfDay),
      count: todayCount,
      solved: [], // 日历模式无法获取具体题目
      source: 'calendar'
    };
  } catch (e) {
    console.warn('Calendar fallback also failed:', e);
    return {
      dateKey: formatDateKey(startOfDay),
      count: 0,
      solved: [],
      source: 'error'
    };
  }
}

async function getRecentSubmissions(startTs) {
  const query = `
    query recentSubmissions($offset: Int!, $limit: Int!) {
      recentSubmissionList(offset: $offset, limit: $limit) {
        id
        status
        statusDisplay
        title
        titleSlug
        timestamp
      }
    }
  `;

  let offset = 0;
  const limit = 20;
  const uniqueBySlug = new Map();
  
  for (let page = 0; page < 5; page++) {
    const data = await fetchGraphQL(query, { offset, limit });
    const list = data?.recentSubmissionList || [];
    if (list.length === 0) break;
    
    for (const s of list) {
      const ts = Number(s.timestamp) || 0;
      if (ts < startTs) {
        page = 999; // 停止扫描更早的提交
        break;
      }
      const accepted = (s.status === 'ACCEPTED') || (s.statusDisplay === 'Accepted');
      if (accepted && s.titleSlug) {
        if (!uniqueBySlug.has(s.titleSlug)) {
          uniqueBySlug.set(s.titleSlug, { 
            title: s.title, 
            titleSlug: s.titleSlug, 
            timestamp: ts 
          });
        }
      }
    }
    offset += limit;
  }

  return Array.from(uniqueBySlug.values()).sort((a, b) => b.timestamp - a.timestamp);
}

async function getSubmissionCalendar() {
  const query = `
    query userProfileCalendar($username: String!, $year: Int!) {
      matchedUser(username: $username) {
        userCalendar(year: $year) {
          submissionCalendar
        }
      }
    }
  `;

  // 尝试获取当前用户名（从页面或API）
  const username = await getCurrentUsername();
  if (!username) {
    throw new Error('Cannot get username for calendar');
  }

  const year = new Date().getFullYear();
  const data = await fetchGraphQL(query, { username, year });
  const calendar = data?.matchedUser?.userCalendar?.submissionCalendar;
  
  if (!calendar) {
    throw new Error('No calendar data');
  }

  return JSON.parse(calendar);
}

async function getCurrentUsername() {
  // 尝试从页面获取用户名
  const usernameEl = document.querySelector('[data-cy="username"]') || 
                     document.querySelector('.username') ||
                     document.querySelector('[href*="/profile/"]');
  
  if (usernameEl) {
    const href = usernameEl.getAttribute('href') || '';
    const match = href.match(/\/profile\/([^\/]+)/);
    if (match) return match[1];
    return usernameEl.textContent?.trim();
  }

  // 尝试从API获取当前用户信息
  try {
    const query = `
      query getCurrentUser {
        userStatus {
          username
        }
      }
    `;
    const data = await fetchGraphQL(query);
    return data?.userStatus?.username;
  } catch (e) {
    return null;
  }
}

async function refreshAndCache() {
  try {
    const todayStats = await getTodaySolvedDistinct();
    await chrome.runtime.sendMessage({ type: 'SET_CACHE', todayStats, latestSolved: todayStats.solved.slice(0, 5) });
  } catch (e) {
    // swallow in content script; popup可做兜底显示
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'REFRESH_STATS') {
    refreshAndCache();
  }
});

// 初次加载与用户在LeetCode活动时刷新
refreshAndCache();
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refreshAndCache();
});


