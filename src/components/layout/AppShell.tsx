import { Suspense, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { LogOut, MessageCircle } from 'lucide-react';
import { Toaster } from 'sonner';

import { pageEnter } from '../../lib/motion';
import { Icon } from '../ui/Icon';
import { Logo } from '../ui/Logo';
import { ErrorBoundary } from '../common/ErrorBoundary';
import Navbar from './Navbar';
import BottomNav from './BottomNav';
import ChatDrawer from './ChatDrawer';
import ScrollToTop from '../ui/ScrollToTop';
import LeagueSwitcher from './LeagueSwitcher';
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

        <header className="max-w-6xl mx-auto px-4 sm:px-6 mb-8 flex items-center gap-3">
          {/* Brand — left-aligned so it never collides with the actions */}
          <div className="flex items-center gap-2.5 shrink-0">
            <Logo className="w-9 h-9 xl:w-10 xl:h-10" />
            <span className="hidden lg:block font-heading font-bold text-white text-lg xl:text-xl whitespace-nowrap">
              Fantasy Hockey Draft
            </span>
          </div>

          {/* Divider + league switcher */}
          <div className="hidden sm:block h-7 w-px bg-white/10 shrink-0" />
          <div className="min-w-0">
            <LeagueSwitcher />
          </div>

          {/* Flexible gap keeps identity + actions on the far right */}
          <div className="flex-1" />

          {/* Identity + actions (labels collapse to icons below xl) */}
          <div className="flex items-center gap-2 xl:gap-3 shrink-0">
            <div className="hidden xl:block text-right leading-tight">
              <p className="text-white font-semibold text-sm">{user?.displayName || user?.email || 'User'}</p>
              <p className="text-gray-400 text-xs">Signed in</p>
            </div>
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Profile" className="w-9 h-9 xl:w-10 xl:h-10 rounded-full border-2 border-white/20" />
            ) : (
              <div className="w-9 h-9 xl:w-10 xl:h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                {(user?.displayName || user?.email || 'U')[0].toUpperCase()}
              </div>
            )}
            {/* On phones (<md) chat lives in the bottom nav, so hide it here to avoid a duplicate */}
            <button
              type="button"
              onClick={() => setIsChatOpen(true)}
              aria-label="Open league chat"
              className="relative hidden md:inline-flex items-center gap-1.5 whitespace-nowrap bg-transparent hover:bg-white/10 text-gray-400 hover:text-white px-3 xl:px-4 py-2 rounded-lg transition-colors text-sm font-medium border border-white/10 hover:border-white/30"
            >
              <Icon as={MessageCircle} size="sm" /> <span className="hidden xl:inline">Chat</span>
              {unread > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-live text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                  {unread}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => signOut()}
              aria-label="Sign out"
              className="inline-flex items-center gap-1.5 whitespace-nowrap bg-transparent hover:bg-white/10 text-gray-400 hover:text-white px-3 xl:px-4 py-2 rounded-lg transition-colors text-sm font-medium border border-white/10 hover:border-white/30"
            >
              <Icon as={LogOut} size="sm" /> <span className="hidden xl:inline">Sign Out</span>
            </button>
          </div>
        </header>

        <Navbar />

        <motion.div variants={pageEnter} initial="initial" animate="animate">
          {children}
        </motion.div>

        {/* Lazy modals get their own boundary so loading their chunks never
            blanks the whole shell behind App's "Loading view…" fallback. */}
        <Suspense fallback={null}>
          <PlayerComparisonModal />
        </Suspense>
        <ChatDrawer isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
        <Suspense fallback={null}>
          <DraftCelebration show={showCelebration} playerName={celebrationPlayer} onComplete={() => setShowCelebration(false)} />
        </Suspense>
        <ScrollToTop />
        <BottomNav onOpenChat={() => setIsChatOpen(true)} unread={unread} />
      </div>
    </ErrorBoundary>
  );
}
