import { useState, useEffect, Suspense } from 'react';
import { Toaster } from 'sonner';
import Login from './components/Login';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import Navbar from './components/layout/Navbar';
import Dashboard from './components/Dashboard';
import { useAuth } from './context/AuthContext';
import { useDraft } from './context/DraftContext';
import { useTurnNotification } from './hooks/useTurnNotification';
import { lazyWithRetry } from './utils/lazyWithRetry';
import ScrollToTop from './components/ui/ScrollToTop';
import type { Tab } from './types';

const PlayerList = lazyWithRetry(() => import('./components/PlayerList'))
const NHLRoster = lazyWithRetry(() => import('./components/NHLRoster'))
const DraftBoardGrid = lazyWithRetry(() => import('./components/DraftBoardGrid'))
const LeagueSettings = lazyWithRetry(() => import('./components/LeagueSettings'))
const Standings = lazyWithRetry(() => import('./components/Standings'))
const LeagueChat = lazyWithRetry(() => import('./components/LeagueChat'))
const Injuries = lazyWithRetry(() => import('./components/Injuries'))
const PlayerComparisonModal = lazyWithRetry(() => import('./components/modals/PlayerComparisonModal'))
const DraftCelebration = lazyWithRetry(() => import('./components/draft/DraftCelebration'))

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [isNavOpen, setIsNavOpen] = useState(false)
  const [showCelebration, setShowCelebration] = useState(false)
  const [celebrationPlayer, setCelebrationPlayer] = useState('')
  const [rosterSearchQuery, setRosterSearchQuery] = useState('')
  const { user, loading: authLoading, signOut } = useAuth()
  const { draftState } = useDraft()

  // Turn notifications (sound + browser notification)
  useTurnNotification()

  // Debug logging - MUST be at top before any returns
  useEffect(() => {
    if (user) {
      console.log('App component mounted');
      console.log('User:', user);
      console.log('User email:', user?.email);
      console.log('User displayName:', user?.displayName);
    }
  }, [user]);

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
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
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
      <div className="min-h-screen py-8">
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
              <h1 className="text-3xl font-bold text-white">Fantasy Hockey Draft</h1>
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
              onClick={() => signOut()}
              className="bg-transparent hover:bg-white/10 text-gray-400 hover:text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium border border-white/10 hover:border-white/30"
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* Tab Navigation */}
        <Navbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isNavOpen={isNavOpen}
          setIsNavOpen={setIsNavOpen}
        />

        {/* Tab Content */}
        <Suspense
          fallback={
            <div className="flex justify-center items-center py-12">
              <div className="text-center text-gray-400">Loading view...</div>
            </div>
          }
        >
          {activeTab === 'dashboard' && <Dashboard setActiveTab={setActiveTab} setRosterSearchQuery={setRosterSearchQuery} />}
          {activeTab === 'roster' && <NHLRoster initialSearchQuery={rosterSearchQuery} onSearchQueryUsed={() => setRosterSearchQuery('')} />}
          {activeTab === 'draftBoard' && (
            <div className="max-w-6xl mx-auto px-6">
              <DraftBoardGrid />
            </div>
          )}
          {activeTab === 'myPlayers' && <PlayerList />}
          {activeTab === 'standings' && <Standings />}
          {activeTab === 'injuries' && <Injuries />}
          {activeTab === 'chat' && <LeagueChat />}
          {activeTab === 'leagueSettings' && <LeagueSettings />}
        </Suspense>

        <PlayerComparisonModal />
        <DraftCelebration show={showCelebration} playerName={celebrationPlayer} onComplete={() => setShowCelebration(false)} />
        <ScrollToTop />
      </div>
    </ErrorBoundary>
  );
}

export default App
