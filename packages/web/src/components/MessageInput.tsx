'use client';

import { useState, type KeyboardEvent } from 'react';

interface MessageInputProps {
  channelId: string;
  onSend: (channelId: string, content: string) => void;
  disabled?: boolean;
}

export default function MessageInput({ channelId, onSend, disabled }: MessageInputProps) {
  const [content, setContent] = useState('');

  const handleSend = () => {
    const trimmed = content.trim();
    if (!trimmed || disabled) return;
    onSend(channelId, trimmed);
    setContent('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-gray-200 bg-white p-4">
      <div className="flex items-end gap-3">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none input-field max-h-32"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !content.trim()}
          className="btn-primary flex-shrink-0"
        >
          Send
        </button>
      </div>
    </div>
  );
}
