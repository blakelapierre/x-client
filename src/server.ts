import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Mock data: accounts and posts. In real version, fetch from X API v2 using bearer token or user OAuth.
interface Post {
  id: string;
  text: string;
  createdAt: string; // ISO
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
      { id: 'p5', text: 'The hottest new programming language is English.', createdAt: new Date(Date.now() - 1800000).toISOString(), likes: 78000, retweets: 15000 }, // newest
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

// In-memory last seen timestamps per account (for "new" detection). In real app, persist per user.
const lastSeen: Record<string, string> = {};

function getLatestPostTime(account: Account): string {
  if (account.posts.length === 0) return '1970-01-01T00:00:00Z';
  return account.posts.reduce((latest, post) => post.createdAt > latest ? post.createdAt : latest, account.posts[0].createdAt);
}

function hasNewPosts(account: Account): boolean {
  const latest = getLatestPostTime(account);
  const seen = lastSeen[account.id] || '1970-01-01T00:00:00Z';
  return latest > seen;
}

// GET /api/accounts - sorted by latest post, with new flag
app.get('/api/accounts', (req, res) => {
  const sorted = [...mockAccounts].sort((a, b) => {
    const ta = getLatestPostTime(a);
    const tb = getLatestPostTime(b);
    return tb.localeCompare(ta); // newest first
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
app.get('/api/accounts/:id/posts', (req, res) => {
  const account = mockAccounts.find(a => a.id === req.params.id);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  // Mark as seen
  lastSeen[account.id] = getLatestPostTime(account);
  const posts = [...account.posts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json({ account: { id: account.id, username: account.username, displayName: account.displayName, avatar: account.avatar }, posts });
});

// POST /api/accounts/:id/seen - mark seen without fetching
app.post('/api/accounts/:id/seen', (req, res) => {
  const account = mockAccounts.find(a => a.id === req.params.id);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  lastSeen[account.id] = getLatestPostTime(account);
  res.json({ ok: true });
});

// GET /api/feed - all posts, newest first, with account info
app.get('/api/feed', (req, res) => {
  const all: Array<Post & { account: { id: string; username: string; displayName: string; avatar: string } }> = [];
  mockAccounts.forEach(acc => {
    acc.posts.forEach(post => {
      all.push({
        ...post,
        account: { id: acc.id, username: acc.username, displayName: acc.displayName, avatar: acc.avatar }
      });
    });
  });
  all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(all.slice(0, 50)); // limit
});

// Health
app.get('/api/health', (req, res) => res.json({ status: 'ok', mode: 'mock' }));

app.listen(PORT, () => {
  console.log(`X Client server running on http://localhost:${PORT}`);
  console.log('Using mock data. Set up X API credentials for real data.');
});
