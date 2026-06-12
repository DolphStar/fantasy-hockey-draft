import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLeague } from '../context/LeagueContext';
import { subscribeRecentLeagueMessages } from '../services/chatService';
import type { ChatMessage } from '../types/chat';

const UNREAD_MESSAGE_LIMIT = 50;

function lastReadKey(leagueId: string) {
  return `chat:lastReadAt:${leagueId}`;
}

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked (private mode, disabled cookies, etc.) - degrade gracefully.
  }
}

/** Returns unread chat count; marks read while the drawer is open. */
export function useUnreadChat(isOpen: boolean) {
  const { user } = useAuth();
  const { league } = useLeague();
  const leagueId = league?.id;
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    setMessages([]);
    if (!leagueId) return;
    return subscribeRecentLeagueMessages(leagueId, setMessages, UNREAD_MESSAGE_LIMIT);
  }, [leagueId]);

  useEffect(() => {
    if (isOpen && leagueId) safeSetItem(lastReadKey(leagueId), String(Date.now()));
  }, [isOpen, leagueId, messages.length]);

  if (!leagueId || isOpen) return 0;
  const lastRead = Number(safeGetItem(lastReadKey(leagueId)) ?? 0);
  return messages.filter(
    (m) => new Date(m.createdAt).getTime() > lastRead && m.userId !== user?.uid
  ).length;
}
