/* global chrome */

const REFRESH_MINUTES = 5;

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('refreshLeetCodeStats', { periodInMinutes: REFRESH_MINUTES });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'refreshLeetCodeStats') {
    chrome.tabs.query({ url: ["https://leetcode.com/*", "https://leetcode.cn/*"] }, (tabs) => {
      for (const tab of tabs) {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, { type: 'REFRESH_STATS' });
        }
      }
    });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'GET_CACHE') {
    chrome.storage.local.get(['todayStats', 'latestSolved'], (data) => {
      sendResponse(data);
    });
    return true;
  }
  if (message?.type === 'SET_CACHE') {
    chrome.storage.local.set({ todayStats: message.todayStats, latestSolved: message.latestSolved });
    sendResponse({ ok: true });
    return true;
  }
});


