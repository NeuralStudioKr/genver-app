'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, type DisplayChannel as Channel } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import UserAvatar from './UserAvatar';

interface OnlineUser { id: string; displayName: string; isBot: boolean; status: string; }

export default function Sidebar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeChannel = searchParams.get('channel');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  useEffect(() => {
    api.getChannels().then(setChannels).catch(() => {});
    api.getUsers().then((users) => {
      setOnlineUsers(users.filter(u => u.status === 'online' && u.id !== user?.id).map(u => ({
        id: u.id, displayName: u.display_name, isBot: u.type === 'bot', status: u.status,
      })));
    }).catch(() => {});
  }, [user?.id]);

  return (
    <div className="w-64 bg-sidebar text-gray-300 flex flex-col h-full flex-shrink-0">
      <div className="h-14 border-b border-white/10 flex items-center px-4">
        <h1 className="font-bold text-white text-lg tracking-tight">Genver</h1>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-3">
          <button onClick={() => router.push('/drive')} className="w-full text-left px-3 py-1.5 rounded-md text-sm text-gray-400 hover:text-white hover:bg-sidebar-hover transition-colors">📁 Drive</button>
        </div>
        <div className="px-3 pb-2">
          <span className="px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Channels</span>
          {channels.map(ch => (
            <button key={ch.id} onClick={() => router.push(`/?channel=${ch.id}`)}
              className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${activeChannel === ch.id ? 'bg-sidebar-active text-white' : 'text-gray-400 hover:text-white hover:bg-sidebar-hover'}`}>
              <span className="mr-1.5 text-gray-500">#</span>{ch.name}
            </button>
          ))}
        </div>
        {onlineUsers.length > 0 && (
          <div className="px-3 pb-4">
            <span className="px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Online — {onlineUsers.length}</span>
            {onlineUsers.map(u => (
              <div key={u.id} className="flex items-center gap-2 px-3 py-1 text-sm text-gray-400">
                <span style={{width:8,height:8,borderRadius:'50%',backgroundColor:'#22c55e',flexShrink:0}} />
                {u.isBot && <span className="text-xs bg-blue-500/20 text-blue-300 px-1 rounded">🤖</span>}
                <span className="truncate">{u.displayName}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {user && (
        <div className="border-t border-white/10 p-3 flex items-center gap-2">
          <UserAvatar user={user} size="sm" />
          <div className="flex-1 min-w-0"><p className="text-sm text-white truncate">{user.displayName}</p></div>
          <button onClick={logout} className="text-xs text-gray-500 hover:text-white transition-colors">Logout</button>
        </div>
      )}
    </div>
  );
}
