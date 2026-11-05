"use strict";
let accounts = [];
let currentAccountId = null;
let pollInterval = null;
async function fetchAccounts() {
    try {
        const res = await fetch('/api/accounts');
        accounts = await res.json();
        renderAccounts();
        if (currentAccountId) {
            // refresh posts if viewing one
            loadPosts(currentAccountId);
        }
    }
    catch (err) {
        console.error('Failed to fetch accounts', err);
    }
}
function renderAccounts() {
    const list = document.getElementById('accounts-list');
    list.innerHTML = '';
    accounts.forEach(acc => {
        const item = document.createElement('div');
        item.className = `account-item ${acc.hasNew ? 'has-new' : ''} ${currentAccountId === acc.id ? 'active' : ''}`;
        item.innerHTML = `
      <img src="${acc.avatar}" alt="${acc.username}" class="avatar" onerror="this.src='https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png'">
      <div class="account-info">
        <div class="name">${acc.displayName} <span class="username">@${acc.username}</span></div>
        <div class="meta">${acc.hasNew ? '<span class="new-badge">NEW</span>' : ''} ${formatTime(acc.latestPostTime)} · ${acc.postCount} posts</div>
      </div>
    `;
        item.onclick = () => selectAccount(acc.id);
        list.appendChild(item);
    });
}
async function selectAccount(id) {
    currentAccountId = id;
    document.getElementById('main-view').classList.add('show-posts');
    renderAccounts(); // update active
    await loadPosts(id);
}
async function loadPosts(id) {
    const postsView = document.getElementById('posts-view');
    postsView.innerHTML = '<div class="loading">Loading posts...</div>';
    try {
        const res = await fetch(`/api/accounts/${id}/posts`);
        if (!res.ok)
            throw new Error('Not found');
        const data = await res.json();
        renderPosts(data);
    }
    catch (err) {
        postsView.innerHTML = '<div class="error">Failed to load posts</div>';
    }
}
function renderPosts(data) {
    const postsView = document.getElementById('posts-view');
    const header = `
    <div class="posts-header">
      <button id="back-btn" class="back-btn">← Back</button>
      <img src="${data.account.avatar}" class="avatar small">
      <div>
        <div class="name">${data.account.displayName}</div>
        <div class="username">@${data.account.username}</div>
      </div>
    </div>
  `;
    const postsHtml = data.posts.map(post => `
    <div class="post">
      <div class="post-time">${formatTime(post.createdAt)}</div>
      <div class="post-text">${escapeHtml(post.text)}</div>
      <div class="post-stats">❤ ${post.likes.toLocaleString()} · 🔁 ${post.retweets.toLocaleString()}</div>
    </div>
  `).join('');
    postsView.innerHTML = header + postsHtml;
    document.getElementById('back-btn').onclick = () => {
        currentAccountId = null;
        document.getElementById('main-view').classList.remove('show-posts');
        renderAccounts();
    };
}
function formatTime(iso) {
    const d = new Date(iso);
    const now = new Date();
    const diff = (now.getTime() - d.getTime()) / 1000;
    if (diff < 60)
        return 'just now';
    if (diff < 3600)
        return `${Math.floor(diff / 60)}m`;
    if (diff < 86400)
        return `${Math.floor(diff / 3600)}h`;
    return d.toLocaleDateString();
}
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
function startPolling() {
    if (pollInterval)
        clearInterval(pollInterval);
    pollInterval = window.setInterval(fetchAccounts, 15000); // every 15s for "real-time"
}
// Init
document.addEventListener('DOMContentLoaded', () => {
    fetchAccounts();
    startPolling();
    // Optional: show all feed button
    document.getElementById('feed-btn')?.addEventListener('click', async () => {
        currentAccountId = null;
        document.getElementById('main-view').classList.remove('show-posts');
        const postsView = document.getElementById('posts-view');
        postsView.innerHTML = '<div class="loading">Loading feed...</div>';
        const res = await fetch('/api/feed');
        const posts = await res.json();
        postsView.innerHTML = '<h3>All Recent Posts</h3>' + posts.map((p) => `
      <div class="post">
        <div class="post-account"><img src="${p.account.avatar}" class="avatar tiny"> @${p.account.username}</div>
        <div class="post-time">${formatTime(p.createdAt)}</div>
        <div class="post-text">${escapeHtml(p.text)}</div>
        <div class="post-stats">❤ ${p.likes.toLocaleString()} · 🔁 ${p.retweets.toLocaleString()}</div>
      </div>
    `).join('');
    });
});
