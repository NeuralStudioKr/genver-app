const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('genver_token') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export interface User {
  id: string;
  email: string;
  display_name: string;
  type: 'human' | 'bot' | 'system';
  bot_type: string | null;
  status: string;
  last_seen_at: string | null;
  created_at: string;
}

export interface Channel {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  type: 'public' | 'private' | 'dm' | 'group_dm';
  topic: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface MessageSender {
  id: string;
  displayName: string;
  senderType: 'human' | 'bot' | 'system';
}

export interface Message {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  contentType: string;
  parentId: string | null;
  replyCount: number;
  fileIds: string[];
  mentions: string[];
  editedAt: string | null;
  isPinned: boolean;
  createdAt: string;
  sender: MessageSender | null;
}

export interface DriveFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// ---- Frontend display types (normalized) ----

export interface DisplayUser {
  id: string;
  displayName: string;
  senderType: string;
  isBot: boolean;
  avatarUrl: null;
}

export interface DisplayChannel {
  id: string;
  name: string;
  displayName: string;
  topic: string | null;
  memberCount: number;
  createdAt: string;
}

export interface DisplayMessage {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  parentId: string | null;
  threadId: string | null;
  replyCount: number;
  createdAt: string;
  user: DisplayUser;
  mentions: string[];
  isBot: boolean;
  reactions: { emoji: string; userIds: string[] }[];
}

// ---- Helpers ----

function normalizeUser(u: User): DisplayUser {
  return {
    id: u.id,
    displayName: u.display_name,
    senderType: u.type,
    isBot: u.type === 'bot',
    avatarUrl: null,
  };
}

function normalizeChannel(c: Channel, memberCount?: number): DisplayChannel {
  return {
    id: c.id,
    name: c.name,
    displayName: c.display_name,
    topic: c.topic,
    memberCount: memberCount || 0,
    createdAt: c.created_at,
  };
}

function normalizeMessage(m: Message): DisplayMessage {
  return {
    id: m.id,
    channelId: m.channelId,
    userId: m.userId,
    content: m.content,
    parentId: m.parentId,
    threadId: m.parentId,
    replyCount: m.replyCount,
    createdAt: m.createdAt,
      user: m.sender
        ? { id: m.sender.id, displayName: m.sender.displayName, senderType: m.sender.senderType, isBot: m.sender.senderType === 'bot', avatarUrl: null }
        : { id: m.userId, displayName: 'Unknown', senderType: 'human' as const, isBot: false, avatarUrl: null },
    mentions: m.mentions || [],
    isBot: m.sender?.senderType === 'bot',
    reactions: [],
  };
}

// ---- API ----

export const api = {
  async register(email: string, password: string, displayName: string) {
    return request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: { email, password, displayName },
    });
  },

  async login(email: string, password: string) {
    return request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
  },

  async getCurrentUser(): Promise<User> {
    const token = typeof window !== 'undefined' ? localStorage.getItem('genver_token') : null;
    if (!token) throw new Error('Not authenticated');
    const payload = JSON.parse(atob(token.split('.')[1]));
    return { id: payload.userId, email: '', display_name: 'User', type: payload.userType, bot_type: null, status: 'online', last_seen_at: null, created_at: '' };
  },

  async getChannels(): Promise<DisplayChannel[]> {
    const data = await request<{ channels: Channel[] }>('/api/channels');
    return (data.channels || []).map(normalizeChannel);
  },

  async getChannel(id: string): Promise<DisplayChannel> {
    const data = await request<any>(`/api/channels/${id}`);
    const ch = data.channel || data;
    const count = Array.isArray(data.members) ? data.members.length : (data.memberCount || 0);
    return normalizeChannel(ch, count);
  },

  async getMessages(channelId: string, before?: string): Promise<DisplayMessage[]> {
    const params = before ? `?before=${before}` : '';
    const data = await request<{ messages: Message[] }>(`/api/channels/${channelId}/messages${params}`);
    return (data.messages || []).map(normalizeMessage);
  },

  async sendMessage(channelId: string, content: string, threadId?: string) {
    const data = await request<{ message: Message }>(`/api/channels/${channelId}/messages`, {
      method: 'POST',
      body: { content, parentId: threadId },
    });
    return normalizeMessage(data.message);
  },

  async getDriveFiles(folderId?: string) {
    const params = folderId ? `?folderId=${folderId}` : '';
    const data = await request<{ files: any[] }>(`/api/drive/files${params}`);
    return (data.files || []).map((f: any) => ({
      id: f.id,
      name: f.name,
      size: f.size_bytes || 0,
      mimeType: f.mime_type || 'application/octet-stream',
      folderId: f.folder_id || null,
      createdAt: f.created_at || '',
      updatedAt: f.updated_at || '',
    }));
  },

async uploadFile(formData: FormData) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('genver_token') : null;
    const headers: Record<string, string> = {};
    if (token) { headers['Authorization'] = `Bearer ${token}`; }
    const res = await fetch(`${API_BASE}/api/drive/files/upload`, { method: 'POST', headers, body: formData });
    if (!res.ok) throw new Error('Upload failed');
    const data = await res.json();
    const f = data.file;
    return {
      id: f.id, name: f.name,
      size: f.size_bytes || 0, mimeType: f.mime_type || 'application/octet-stream',
      folderId: f.folder_id || null, createdAt: f.created_at || '', updatedAt: f.updated_at || '',
    };
  },

  downloadFileUrl(id: string) {
    return `${API_BASE}/api/drive/files/${id}/download`;
  },

  async deleteFile(id: string) {
    return request<void>(`/api/drive/files/${id}`, { method: 'DELETE' });
  },

  async getUsers(): Promise<User[]> {
    const data = await request<{ users: User[] }>('/api/users');
    return data.users || [];
  },
};
