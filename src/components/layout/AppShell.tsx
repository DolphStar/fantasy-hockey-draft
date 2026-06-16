import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle } from 'lucide-react';
import { Toaster } from 'sonner';

import { pageEnter } from '../../lib/motion';
import { Icon } from '../ui/Icon';
import { ErrorBoundary } from '../common/ErrorBoundary';
import Navbar from './Navbar';
import BottomNav from './BottomNav';
import ChatDrawer from './ChatDrawer';
import ScrollToTop from '../ui/ScrollToTop';
import { useUnreadChat } from '../../hooks/useUnreadChat';
import { useAuth } from '../../context/AuthContext';
import { useDraft } from '../../context/DraftContext';
import { useTurnNotification } from '../../hooks/useTurnNotification';
import { lazyWithRetry } from '../../utils/lazyWithRetry';

const PlayerComparisonModal = lazyWithRetry(() => import('../modals/PlayerComparisonModal'));
const DraftCelebration = lazyWithRetry(() => import('../draft/DraftCelebration'));

export default function AppShell({ children }: { children: ReactNode }) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationPlayer, setCelebrationPlayer] = useState('');
  const { user, signOut } = useAuth();
  const { draftState } = useDraft();
  const unread = useUnreadChat(isChatOpen);

  useTurnNotification();

  useEffect(() => {
    if (draftState?.lastPick) {
      const lastPick = draftState.lastPick;
      const pickTime = new Date(lastPick.timestamp).getTime();
      if (Date.now() - pickTime < 5000) {
        setCelebrationPlayer(lastPick.playerName);
        setShowCelebration(true);
      }
    }
  }, [draftState?.lastPick]);

  return (
    <ErrorBoundary>
      <div className="min-h-screen py-8 pb-24 md:pb-8">
        <Toaster position="top-right" richColors />

        <header className="max-w-6xl mx-auto px-6 mb-8 grid grid-cols-3 items-center">
          <div className="justify-self-start" />
          <div className="justify-self-center text-center">
            <div className="flex items-center justify-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-slate-900/80 border border-white/15 flex items-center justify-center shadow-inner shadow-blue-900/40">
                <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 4l7.5 13" className="text-blue-400" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M9 4h3l7 13h-3z" className="text-blue-200/80" fill="currentColor" fillOpacity="0.15" />
                  <path d="M19 4L11.5 17" className="text-cyan-300" stroke="currentColor" strokeWidth="1.6" />
                  <ellipse cx="12" cy="19" rx="4" ry="1.4" className="text-blue-500/60" fill="currentColor" />
                </svg>
              </div>
              <p className="text-3xl font-bold text-white">Fantasy Hockey Draft</p>
            </div>
            <p className="text-gray-400 text-sm">Browse NHL rosters and manage your draft picks</p>
          </div>
          <div className="justify-self-end flex items-center gap-4">
            <div className="text-right">
              <p className="text-white font-semibold">{user?.displayName || user?.email || 'User'}</p>
              <p className="text-gray-400 text-sm">Signed in</p>
            </div>
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Profile" className="w-10 h-10 rounded-full border-2 border-white/20" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                {(user?.displayName || user?.email || 'U')[0].toUpperCase()}
              </div>
            )}
            <button
              type="button"
              onClick={() => setIsChatOpen(true)}
              className="relative bg-transparent hover:bg-white/10 text-gray-400 hover:text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium border border-white/10 hover:border-white/30"
            >
              <span className="inline-flex items-center gap-1.5"><Icon as={MessageCircle} size="sm" /> Chat</span>
              {unread > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-live text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                  {unread}
                </span>
              )}
            </button>
            <button
              onClick={() => signOut()}
              className="bg-transparent hover:bg-white/10 text-gray-400 hover:text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium border border-white/10 hover:border-white/30"
            >
              Sign Out
            </button>
          </div>
        </header>

        <Navbar />

        <motion.div variants={pageEnter} initial="initial" animate="animate">
          {children}
        </motion.div>

        <PlayerComparisonModal />
        <ChatDrawer isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
        <DraftCelebration show={showCelebration} playerName={celebrationPlayer} onComplete={() => setShowCelebration(false)} />
        <ScrollToTop />
        <BottomNav onOpenChat={() => setIsChatOpen(true)} unread={unread} />
      </div>
    </ErrorBoundary>
  );
}
