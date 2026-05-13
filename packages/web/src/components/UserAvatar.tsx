'use client';

import { type AuthUser } from '@/lib/auth';

interface UserAvatarProps {
  user: AuthUser;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses: Record<string, string> = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-12 h-12 text-lg',
};

export default function UserAvatar({ user, size = 'md' }: UserAvatarProps) {
  const initials = (user.displayName || '?')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (user.avatarUrl) {
    return (
      <img src={user.avatarUrl} alt={user.displayName}
        className={`${sizeClasses[size]} rounded-full object-cover flex-shrink-0`} />
    );
  }

  const bgClass = user.isBot ? 'bg-blue-500' : 'bg-gray-500';
  return (
    <div className={`${sizeClasses[size]} ${bgClass} text-white rounded-full flex items-center justify-center font-semibold flex-shrink-0`}>
      {initials}
    </div>
  );
}
