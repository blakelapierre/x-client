import fs from 'fs/promises';
import path from 'path';

const X_API_BASE = 'https://api.twitter.com/2';

export interface XUser {
  id: string;
  username: string;
  name: string;
  profile_image_url?: string;
}

export interface XTweet {
  id: string;
  text: string;
  created_at: string;
  public_metrics?: {
    like_count: number;
    retweet_count: number;
    reply_count: number;
    quote_count: number;
  };
  author_id?: string;
}

export class XClient {
  private bearerToken: string | undefined;
  private userToken: string | undefined;

  constructor() {
    this.bearerToken = process.env.TWITTER_BEARER_TOKEN;
    this.userToken = process.env.TWITTER_USER_TOKEN;
  }

  setUserToken(token: string | undefined) {
    this.userToken = token;
  }

  isConfigured(): boolean {
    return !!(this.bearerToken || this.userToken);
  }

  hasUserToken(): boolean {
    return !!this.userToken;
  }

  private async request(endpoint: string, params: Record<string, string> = {}, useUserToken = false): Promise<any> {
    const token = useUserToken && this.userToken ? this.userToken : this.bearerToken;
    if (!token) throw new Error('No X API token configured');

    const url = new URL(`${X_API_BASE}${endpoint}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (res.status === 429) {
      const retryAfter = res.headers.get('x-rate-limit-reset');
      throw new Error(`Rate limited. Retry after ${retryAfter}`);
    }
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`X API error ${res.status}: ${err}`);
    }
    return res.json();
  }

  async getUserByUsername(username: string): Promise<XUser | null> {
    try {
      const data = await this.request(`/users/by/username/${username}`, {
        'user.fields': 'profile_image_url,name,username',
      });
      return data.data || null;
    } catch (e) {
      console.error(`Failed to get user ${username}:`, e);
      return null;
    }
  }

  async getRecentTweets(userId: string, maxResults = 10): Promise<XTweet[]> {
    try {
      const data = await this.request(`/users/${userId}/tweets`, {
        max_results: String(Math.min(maxResults, 100)),
        'tweet.fields': 'created_at,public_metrics,author_id',
        exclude: 'retweets,replies',
      });
      return data.data || [];
    } catch (e) {
      console.error(`Failed to get tweets for ${userId}:`, e);
      return [];
    }
  }

  async getMe(): Promise<XUser | null> {
    if (!this.userToken) return null;
    try {
      const data = await this.request('/users/me', {
        'user.fields': 'profile_image_url,name,username',
      }, true);
      return data.data || null;
    } catch (e) {
      console.error('Failed to get me:', e);
      return null;
    }
  }

  async getFollowing(userId: string, maxResults = 100): Promise<XUser[]> {
    if (!this.userToken) {
      console.warn('User token required for following list');
      return [];
    }
    try {
      const data = await this.request(`/users/${userId}/following`, {
        max_results: String(Math.min(maxResults, 1000)),
        'user.fields': 'profile_image_url,name,username',
      }, true);
      return data.data || [];
    } catch (e) {
      console.error('Failed to get following:', e);
      return [];
    }
  }
}

// Persistence for last-seen
const DATA_DIR = path.join(process.cwd(), '.data');
const LASTSEEN_FILE = path.join(DATA_DIR, 'lastseen.json');

export async function loadLastSeen(): Promise<Record<string, string>> {
  try {
    const raw = await fs.readFile(LASTSEEN_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function saveLastSeen(data: Record<string, string>): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(LASTSEEN_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Failed to save lastSeen:', e);
  }
}
