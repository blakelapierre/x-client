import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { XClient, loadLastSeen, saveLastSeen, XUser, XTweet } from './x-api';
import {
  generatePKCE,
  saveState,
  loadState,
  clearState,
  saveTokens,
  loadTokens,
  clearTokens,
  getAuthUrl,
  exchangeCode,
  refreshAccessToken,
  OAuthTokens,
} from './oauth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const CLIENT_ID = process.env.TWITTER_CLIENT_ID || '';
const CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.TWITTER_REDIRECT_URI || `http://localhost:${PORT}/auth/callback`;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

interface Post {
  id: string;
  text: string;
  createdAt: string;
  likes: number;
  retweets: number;
}

interface Account {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  posts: Post[];
}

// Mock fallback
const mockAccounts: Account[] = [
  {
    id: '1',
    username: 'elonmusk',
    displayName: 'Elon Musk',
    avatar: 'https://pbs.twimg.com/profile_images/1683325380441128960/yRsRRjGO_400x400.jpg',
    posts: [
      { id: 'p1', text: 'Just landed on Mars. Wifi is better than expected.', createdAt: new Date(Date.now() - 3600000).toISOString(), likes: 150000, retweets: 25000 },
      { id: 'p2', text: 'Building the future, one rocket at a time.', createdAt: new Date(Date.now() - 86400000).toISOString(), likes: 89000, retweets: 12000 }
    ]
  },
  {
    id: '2',
    username: 'naval',
    displayName: 'Naval',
    avatar: 'https://pbs.twimg.com/profile_images/1256841238298292232/ycqwaMI2_400x400.jpg',
    posts: [
      { id: 'p3', text: 'Specific knowledge is knowledge that you cannot be trained for. If society can train you, it can train someone else, and replace you.', createdAt: new Date(Date.now() - 7200000).toISOString(), likes: 45000, retweets: 8000 },
      { id: 'p4', text: 'The most important skill for getting rich is becoming a perpetual learner.', createdAt: new Date(Date.now() - 172800000).toISOString(), likes: 32000, retweets: 5000 }
    ]
  },
  {
    id: '3',
    username: 'karpathy',
    displayName: 'Andrej Karpathy',
    avatar: 'https://pbs.twimg.com/profile_images/1296667294148382721/9Pr6XrPB_400x400.jpg',
    posts: [
      { id: 'p5', text: 'The hottest new programming language is English.', createdAt: new Date(Date.now() - 1800000).toISOString(), likes: 78000, retweets: 15000 },
      { id: 'p6', text: 'Software 2.0 is eating the world.', createdAt: new Date(Date.now() - 43200000).toISOString(), likes: 56000, retweets: 9000 }
    ]
  },
  {
    id: '4',
    username: 'paulg',
    displayName: 'Paul Graham',
    avatar: 'https://pbs.twimg.com/profile_images/1824002576/pg-railsconf_400x400.jpg',
    posts: [
      { id: 'p7', text: 'Do things that don\'t scale.', createdAt: new Date(Date.now() - 14400000).toISOString(), likes: 21000, retweets: 4000 }
    ]
  }
];

const xClient = new XClient();
let accountsCache: Account[] = [...mockAccounts];
let lastSeen: Record<string, string> = {};
let mode = 'mock';
let lastRefresh = 0;
let currentUser: { id: string; username: string } | null = null;
const REFRESH_INTERVAL = 60_000;

async function ensureFreshUserToken(): Promise<string | undefined> {
  let tokens = await loadTokens();
  if (!tokens?.access_token) return process.env.TWITTER_USER_TOKEN;

  // Refresh if expiring soon (within 5 min)
  if (tokens.expires_at && tokens.expires_at < Date.now() + 5 * 60 * 1000 && tokens.refresh_token && CLIENT_ID && CLIENT_SECRET) {
    try {
      console.log('Refreshing user access token...');
      const refreshed = await refreshAccessToken(CLIENT_ID, CLIENT_SECRET, tokens.refresh_token);
      tokens = { ...tokens, ...refreshed };
      await saveTokens(tokens);
    } catch (e) {
      console.error('Token refresh failed:', e);
      await clearTokens();
      return undefined;
    }
  }
  return tokens.access_token;
}

async function initAuth(): Promise<void> {
  const token = await ensureFreshUserToken();
  if (token) {
    xClient.setUserToken(token);
    const me = await xClient.getMe();
    if (me) {
      currentUser = { id: me.id, username: me.username };
      console.log(`Logged in as @${me.username} (${me.id})`);
    }
  }
}

function mapTweet(tweet: XTweet): Post {
  return {
    id: tweet.id,
    text: tweet.text,
    createdAt: tweet.created_at,
    likes: tweet.public_metrics?.like_count || 0,
    retweets: tweet.public_metrics?.retweet_count || 0,
  };
}

function mapUser(user: XUser, posts: Post[]): Account {
  return {
    id: user.id,
    username: user.username,
    displayName: user.name,
    avatar: user.profile_image_url || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png',
    posts,
  };
}

async function refreshAccounts(): Promise<void> {
  const userToken = await ensureFreshUserToken();
  if (userToken) xClient.setUserToken(userToken);

  if (!xClient.isConfigured()) {
    accountsCache = [...mockAccounts];
    mode = 'mock';
    return;
  }

  try {
    mode = 'live';
    const usernames = (process.env.FOLLOWING_USERNAMES || 'elonmusk,naval,karpathy,paulg').split(',').map(s => s.trim()).filter(Boolean);

    let users: XUser[] = [];
    if (currentUser && xClient.hasUserToken()) {
      // Prefer real following list when logged in via OAuth
      users = await xClient.getFollowing(currentUser.id, 50);
      console.log(`Fetched ${users.length} accounts from following list`);
    } else {
      // Fallback: resolve listed usernames
      for (const uname of usernames) {
        const u = await xClient.getUserByUsername(uname);
        if (u) users.push(u);
      }
    }

    const newAccounts: Account[] = [];
    for (const user of users.slice(0, 20)) {
      const tweets = await xClient.getRecentTweets(user.id, 5);
      const posts = tweets.map(mapTweet);
      newAccounts.push(mapUser(user, posts));
      await new Promise(r => setTimeout(r, 200));
    }

    if (newAccounts.length > 0) {
      accountsCache = newAccounts;
    }
    lastRefresh = Date.now();
    console.log(`Refreshed ${accountsCache.length} accounts from X API`);
  } catch (e) {
    console.error('Refresh failed, keeping previous cache:', e);
  }
}

function getLatestPostTime(account: Account): string {
  if (account.posts.length === 0) return '1970-01-01T00:00:00Z';
  return account.posts.reduce((latest, post) => post.createdAt > latest ? post.createdAt : latest, account.posts[0].createdAt);
}

function hasNewPosts(account: Account): boolean {
  const latest = getLatestPostTime(account);
  const seen = lastSeen[account.id] || '1970-01-01T00:00:00Z';
  return latest > seen;
}

// Init persistence and first refresh
(async () => {
  lastSeen = await loadLastSeen();
  await initAuth();
  await refreshAccounts();
  setInterval(refreshAccounts, REFRESH_INTERVAL);
})();

// --- OAuth routes ---
app.get('/auth/login', async (req, res) => {
  if (!CLIENT_ID) {
    return res.status(500).send('TWITTER_CLIENT_ID not configured');
  }
  const { code_verifier, code_challenge } = generatePKCE();
  const state = crypto.randomBytes(16).toString('hex');
  await saveState({ code_verifier, state, created: Date.now() });
  const url = getAuthUrl(CLIENT_ID, REDIRECT_URI, code_challenge, state);
  res.redirect(url);
});

app.get('/auth/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
    return res.status(400).send('Missing code or state');
  }

  const saved = await loadState();
  if (!saved || saved.state !== state) {
    return res.status(400).send('Invalid state');
  }
  await clearState();

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return res.status(500).send('Client credentials not configured');
  }

  try {
    const tokens = await exchangeCode(CLIENT_ID, CLIENT_SECRET, code, saved.code_verifier, REDIRECT_URI);
    await saveTokens(tokens);
    xClient.setUserToken(tokens.access_token);
    const me = await xClient.getMe();
    if (me) {
      currentUser = { id: me.id, username: me.username };
      tokens.user_id = me.id;
      tokens.username = me.username;
      await saveTokens(tokens);
    }
    await refreshAccounts();
    res.redirect('/');
  } catch (e: any) {
    console.error(e);
    res.status(500).send('OAuth failed: ' + e.message);
  }
});

app.get('/auth/logout', async (req, res) => {
  await clearTokens();
  xClient.setUserToken(undefined);
  currentUser = null;
  mode = xClient.isConfigured() ? 'live' : 'mock';
  await refreshAccounts();
  res.redirect('/');
});

app.get('/api/me', (req, res) => {
  res.json({ loggedIn: !!currentUser, user: currentUser, mode });
});

// GET /api/accounts - sorted by latest post, with new flag
app.get('/api/accounts', async (req, res) => {
  if (Date.now() - lastRefresh > REFRESH_INTERVAL) {
    await refreshAccounts();
  }
  const sorted = [...accountsCache].sort((a, b) => {
    const ta = getLatestPostTime(a);
    const tb = getLatestPostTime(b);
    return tb.localeCompare(ta);
  }).map(acc => ({
    id: acc.id,
    username: acc.username,
    displayName: acc.displayName,
    avatar: acc.avatar,
    latestPostTime: getLatestPostTime(acc),
    hasNew: hasNewPosts(acc),
    postCount: acc.posts.length
  }));
  res.json(sorted);
});

// GET /api/accounts/:id/posts
app.get('/api/accounts/:id/posts', async (req, res) => {
  const account = accountsCache.find(a => a.id === req.params.id);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  lastSeen[account.id] = getLatestPostTime(account);
  await saveLastSeen(lastSeen);
  const posts = [...account.posts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json({ account: { id: account.id, username: account.username, displayName: account.displayName, avatar: account.avatar }, posts });
});

// POST /api/accounts/:id/seen
app.post('/api/accounts/:id/seen', async (req, res) => {
  const account = accountsCache.find(a => a.id === req.params.id);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  lastSeen[account.id] = getLatestPostTime(account);
  await saveLastSeen(lastSeen);
  res.json({ ok: true });
});

// GET /api/feed
app.get('/api/feed', (req, res) => {
  const all: Array<Post & { account: { id: string; username: string; displayName: string; avatar: string } }> = [];
  accountsCache.forEach(acc => {
    acc.posts.forEach(post => {
      all.push({
        ...post,
        account: { id: acc.id, username: acc.username, displayName: acc.displayName, avatar: acc.avatar }
      });
    });
  });
  all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(all.slice(0, 50));
});

// Health + force refresh
app.get('/api/health', (req, res) => res.json({ status: 'ok', mode, accounts: accountsCache.length, lastRefresh: new Date(lastRefresh).toISOString() }));
app.post('/api/refresh', async (req, res) => {
  await refreshAccounts();
  res.json({ ok: true, mode, count: accountsCache.length });
});

app.listen(PORT, () => {
  console.log(`X Client server running on http://localhost:${PORT}`);
  console.log(`Mode: ${xClient.isConfigured() ? 'live (X API)' : 'mock'}`);
  console.log('Set TWITTER_BEARER_TOKEN and optionally FOLLOWING_USERNAMES / MY_USER_ID + TWITTER_USER_TOKEN for real data.');
});
