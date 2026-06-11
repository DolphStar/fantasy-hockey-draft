import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import LeagueChat from '../LeagueChat';
import { useLeague } from '../../context/LeagueContext';
import { subscribeRecentLeagueMessages } from '../../services/chatService';
import type { ChatMessage } from '../../types/chat';

const LAST_READ_KEY = 'chat:lastReadAt';
const UNREAD_MESSAGE_LIMIT = 50;

/** Returns unread chat count; marks read while the drawer is open. */
export function useUnreadChat(isOpen: boolean) {
  const { league } = useLeague();
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!league) return;
    return subscribeRecentLeagueMessages(league.id, setMessages, UNREAD_MESSAGE_LIMIT);
  }, [league]);

  useEffect(() => {
    if (isOpen) localStorage.setItem(LAST_READ_KEY, String(Date.now()));
  }, [isOpen, messages.length]);

  if (isOpen) return 0;
  const lastRead = Number(localStorage.getItem(LAST_READ_KEY) ?? 0);
  return messages.filter((m) => new Date(m.createdAt).getTime() > lastRead).length;
}

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChatDrawer({ isOpen, onClose }: ChatDrawerProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/50 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[420px] bg-gradient-to-br from-[#101729] to-[#0d1322] border-l border-slate-800 shadow-2xl flex flex-col"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 40 }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <h2 className="text-sm font-bold text-white">💬 League Chat</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close chat"
                className="text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 min-h-0 p-3">
              <LeagueChat variant="embedded" />
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
