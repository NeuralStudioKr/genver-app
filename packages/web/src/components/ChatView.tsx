'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { api, type DisplayMessage as Message, type DisplayChannel as Channel } from '@/lib/api';
import { wsClient } from '@/lib/ws';
import { useAuth } from '@/lib/auth';
import MessageItem from './MessageItem';
import MessageInput from './MessageInput';

interface ChatViewProps { channelId: string; }

export default function ChatView({ channelId }: ChatViewProps) {
  const { user } = useAuth();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [threadMessageId, setThreadMessageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMsgIdRef = useRef<string | null>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const msgs = await api.getMessages(channelId);
      setMessages(msgs);
      if (msgs.length > 0) lastMsgIdRef.current = msgs[msgs.length - 1].id;
      setLoading(false);
    } catch { setLoading(false); }
  }, [channelId]);

  useEffect(() => {
    setThreadMessageId(null); setMessages([]); setLoading(true);
    api.getChannel(channelId).then(setChannel).catch(() => {});
    fetchMessages();
    const poll = setInterval(fetchMessages, 5000);
    return () => clearInterval(poll);
  }, [channelId, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const handler = (data: unknown) => {
      const msg = data as Message;
      if (msg.channelId === channelId && msg.userId !== user?.id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    };
    wsClient.addListener('message', handler);
    return () => wsClient.removeListener('message', handler);
  }, [channelId, user?.id]);

  const handleSend = useCallback(async (chId: string, content: string) => {
    try {
      const msg = await api.sendMessage(chId, content, threadMessageId || undefined);
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    } catch {}
  }, [threadMessageId]);

  const threadMessages = threadMessageId
    ? messages.filter((m) => m.threadId === threadMessageId || m.id === threadMessageId) : [];

  return (
    <div className="flex h-full">
      <div className="flex flex-col flex-1 min-w-0">
        <div className="h-14 border-b border-gray-200 flex items-center px-4 gap-3 bg-white flex-shrink-0">
          <h2 className="font-semibold text-gray-900 text-base">{channel ? `# ${channel.name}` : 'Loading...'}</h2>
          {channel?.topic && <span className="text-sm text-gray-500 pl-2 border-l border-gray-300">{channel.topic}</span>}
          {channel && <span className="ml-auto text-sm text-gray-400">{channel.memberCount} members</span>}
        </div>
        <div className="flex-1 overflow-y-auto bg-white">
          {loading ? <div className="flex items-center justify-center h-full text-gray-400 text-sm">Loading...</div>
          : messages.length === 0 ? <div className="flex items-center justify-center h-full text-gray-400 text-sm">No messages yet.</div>
          : messages.filter((m) => !m.threadId || m.isBot).map((msg) => (
            <MessageItem key={msg.id} message={msg} isCurrentUser={msg.userId === user?.id} onThreadClick={setThreadMessageId} />
          ))}
          <div ref={messagesEndRef} />
        </div>
        <MessageInput channelId={channelId} onSend={handleSend} disabled={!user} />
      </div>
      {threadMessageId && (
        <div className="w-80 border-l border-gray-200 flex flex-col bg-gray-50 flex-shrink-0">
          <div className="h-14 border-b border-gray-200 flex items-center px-4 gap-2 bg-white">
            <h3 className="font-semibold text-sm text-gray-900">Thread</h3>
            <button onClick={() => setThreadMessageId(null)} className="ml-auto text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {threadMessages.map((msg) => <MessageItem key={msg.id} message={msg} isCurrentUser={msg.userId === user?.id} onThreadClick={() => {}} />)}
          </div>
          <MessageInput channelId={channelId} onSend={handleSend} disabled={!user} />
        </div>
      )}
    </div>
  );
}
