import { useState, useEffect, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MessageCircle } from 'lucide-react';
import { Toaster } from 'sonner';
import { pageEnter } from './lib/motion';
import { Icon } from './components/ui/Icon';
import { Skeleton } from './components/ui/Skeleton';
import Login from './components/Login';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import Navbar from './components/layout/Navbar';
import BottomNav from './components/layout/BottomNav';
import ChatDrawer from './components/layout/ChatDrawer';
import { useUnreadChat } from './hooks/useUnreadChat';
import Dashboard from './components/Dashboard';
import PlayersHub from './components/PlayersHub';
import { useAuth } from './context/AuthContext';
import { useDraft } from './context/DraftContext';
import { useTurnNotification } from './hooks/useTurnNotification';
import { lazyWithRetry } from './utils/lazyWithRetry';
import ScrollToTop from './components/ui/ScrollToTop';

const PlayerList = lazyWithRetry(() => import('./components/PlayerList'))
const NHLRoster = lazyWithRetry(() => import('./components/NHLRoster'))
const DraftBoardGrid = lazyWithRetry(() => import('./components/DraftBoardGrid'))
const LeagueSettings = lazyWithRetry(() => import('./components/LeagueSettings'))
const Standings = lazyWithRetry(() => import('./components/Standings'))
const Injuries = lazyWithRetry(() => import('./components/Injuries'))
const PlayerComparisonModal = lazyWithRetry(() => import('./components/modals/PlayerComparisonModal'))
const DraftCelebration = lazyWithRetry(() => import('./components/draft/DraftCelebration'))

function App() {
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [showCelebration, setShowCelebration] = useState(false)
  const [celebrationPlayer, setCelebrationPlayer] = useState('')
  const { user, loading: authLoading, signOut } = useAuth()
  const { draftState } = useDraft()
  const unread = useUnreadChat(isChatOpen)
  const location = useLocation()
  // Key route transitions by top-level segment so in-hub tab switches don't re-fade
  const routeKey = location.pathname.split('/')[1] || 'home'

  // Turn notifications (sound + browser notification)
  useTurnNotification()

  // Show loading while checking auth
  // Listen for draft updates to trigger celebration
  useEffect(() => {
    if (draftState?.lastPick) {
      const lastPick = draftState.lastPick;
      // Only show if it's a recent pick (within last 5 seconds)
      const pickTime = new Date(lastPick.timestamp).getTime();
      const now = Date.now();

      if (now - pickTime < 5000) {
        setCelebrationPlayer(lastPick.playerName);
        setShowCelebration(true);
        // Also play sound here if not the drafter (drafter hears it immediately in NHLRoster)
        // But for simplicity, we can just let the global listener handle it or rely on local feedback
      }
    }
  }, [draftState?.lastPick])

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-full max-w-md space-y-3 px-6">
            <Skeleton className="h-10 w-2/3 mx-auto" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!user) {
    return <Login />;
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen py-8 pb-24 md:pb-8">
        {/* Toast Notifications */}
        <Toaster position="top-right" richColors />

        {/* Header with User Info - 3-column grid for perfect centering */}
        <header className="max-w-6xl mx-auto px-6 mb-8 grid grid-cols-3 items-center">
          {/* Left Column - Empty for balance */}
          <div className="justify-self-start" />

          {/* Center Column - Logo Lockup (Icon + Title) */}
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

          {/* Right Column - User Profile */}
          <div className="justify-self-end flex items-center gap-4">
            <div className="text-right">
              <p className="text-white font-semibold">{user?.displayName || user?.email || 'User'}</p>
              <p className="text-gray-400 text-sm">Signed in</p>
            </div>
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt="Profile"
                className="w-10 h-10 rounded-full border-2 border-white/20"
              />
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

        {/* Section Navigation */}
        <Navbar />

        {/* Routed Content */}
        <Suspense
          fallback={
            <div className="flex justify-center items-center py-12">
              <div className="text-center text-gray-400">Loading view...</div>
            </div>
          }
        >
          <motion.div key={routeKey} variants={pageEnter} initial="initial" animate="animate">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/players" element={<PlayersHub />}>
              <Route index element={<PlayerList />} />
              <Route path="browse" element={<NHLRoster />} />
              <Route path="injuries" element={<Injuries />} />
            </Route>
            <Route path="/scores" element={<Standings />} />
            <Route path="/draft" element={
              <div className="max-w-6xl mx-auto px-6">
                <DraftBoardGrid />
              </div>
            } />
            <Route path="/league" element={<LeagueSettings />} />
            <Route path="/chat" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </motion.div>
        </Suspense>

        <PlayerComparisonModal />
        <ChatDrawer isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
        <DraftCelebration show={showCelebration} playerName={celebrationPlayer} onComplete={() => setShowCelebration(false)} />
        <ScrollToTop />
        <BottomNav onOpenChat={() => setIsChatOpen(true)} unread={unread} />
      </div>
    </ErrorBoundary>
  );
}

export default App
