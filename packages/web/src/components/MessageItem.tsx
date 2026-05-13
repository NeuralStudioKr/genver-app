'use client';

import { type DisplayMessage as Message } from '@/lib/api';
import UserAvatar from './UserAvatar';

interface MessageItemProps {
  message: Message;
  isCurrentUser: boolean;
  onThreadClick: (messageId: string) => void;
}

function renderContent(content: string): React.ReactNode {
  const parts = content.split(/(@[\w-]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      return (
        <span key={i} className="mention">
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export default function MessageItem({ message, isCurrentUser, onThreadClick }: MessageItemProps) {
  const isBot = message.isBot;

  return (
    <div
      className={`group flex gap-3 px-4 py-3 hover:bg-gray-50/50 transition-colors ${
        isBot ? 'bg-bot-bg' : 'bg-white'
      }`}
    >
      <UserAvatar user={message.user} size="md" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`font-semibold text-sm ${isCurrentUser ? 'text-accent' : 'text-gray-900'}`}>
            {message.user.displayName}
          </span>

          {isBot && (
            <span className="bot-badge">
              🤖 BOT
            </span>
          )}

          <span className="text-xs text-gray-400">
            {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
          {renderContent(message.content)}
        </p>

        {message.reactions && message.reactions.length > 0 && (
          <div className="flex gap-1 mt-1.5">
            {message.reactions.map((r, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-gray-100 rounded-md cursor-pointer hover:bg-gray-200"
              >
                {r.emoji} {r.userIds.length}
              </span>
            ))}
          </div>
        )}

        {!message.threadId && (
          <button
            onClick={() => onThreadClick(message.id)}
            className="mt-1 text-xs text-gray-400 hover:text-accent transition-colors opacity-0 group-hover:opacity-100"
          >
            Reply in thread
          </button>
        )}
      </div>
    </div>
  );
}
