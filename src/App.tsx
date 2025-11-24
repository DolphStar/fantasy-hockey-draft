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

        {/* Header with User Info */}
        <div className="max-w-6xl mx-auto px-6 mb-8">
          <div className="flex justify-between items-center">
            <div className="text-center flex-1">
              <h1 className="text-5xl font-bold text-white mb-2">Fantasy Hockey Draft</h1>
              <p className="text-gray-400">Browse NHL rosters and manage your draft picks</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-white font-semibold">{user?.displayName || user?.email || 'User'}</p>
                <p className="text-gray-400 text-sm">Signed in</p>
              </div>
              {user?.photoURL && (
                <img
                  src={user.photoURL}
                  alt="Profile"
                  className="w-10 h-10 rounded-full"
                />
              )}
              <button
                onClick={() => signOut()}
                className="bg-transparent hover:bg-white/10 text-gray-400 hover:text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium border border-white/10 hover:border-white/30"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>

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
          {activeTab === 'dashboard' && <Dashboard setActiveTab={setActiveTab} />}
          {activeTab === 'roster' && <NHLRoster />}
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
