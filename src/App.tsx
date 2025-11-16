import { useState, useEffect, lazy, Suspense } from 'react'
import { Toaster } from 'sonner'
import Login from './components/Login'
import { useAuth } from './context/AuthContext'
import { useTurnNotification } from './hooks/useTurnNotification'

const PlayerList = lazy(() => import('./components/PlayerList'))
const NHLRoster = lazy(() => import('./components/NHLRoster'))
const DraftBoardGrid = lazy(() => import('./components/DraftBoardGrid'))
const LeagueSettings = lazy(() => import('./components/LeagueSettings'))
const Standings = lazy(() => import('./components/Standings'))
const LeagueChat = lazy(() => import('./components/LeagueChat'))
const Injuries = lazy(() => import('./components/Injuries'))

type Tab = 'roster' | 'myPlayers' | 'draftBoard' | 'standings' | 'injuries' | 'leagueSettings' | 'chat'

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('standings')
  const [isNavOpen, setIsNavOpen] = useState(false)
  const { user, loading: authLoading, signOut } = useAuth()
  
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
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
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

  // Test render to isolate the problem
  console.log('About to render main app...');
  
  try {
    return (
      <div className="min-h-screen bg-gray-900 py-8">
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
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-semibold"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>

      {/* Tab Navigation */}
      <div className="max-w-6xl mx-auto px-6 mb-8">
        <div className="flex items-center justify-between md:hidden mb-2">
          <span className="text-gray-300 text-sm font-semibold">Navigation</span>
          <button
            onClick={() => setIsNavOpen((open) => !open)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-700 text-gray-200 text-sm"
          >
            <span>{isNavOpen ? 'Close' : 'Menu'}</span>
            <span className="text-lg">☰</span>
          </button>
        </div>

        <div
          className={`border-b border-gray-700 ${
            isNavOpen ? 'flex' : 'hidden'
          } md:flex flex-col md:flex-row gap-2 md:gap-4`}
        >
          <button
            onClick={() => setActiveTab('roster')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'roster'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🏒 NHL Rosters
          </button>
          <button
            onClick={() => setActiveTab('draftBoard')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'draftBoard'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            📋 Draft Board
          </button>
          <button
            onClick={() => setActiveTab('myPlayers')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'myPlayers'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            👥 My Players
          </button>
          <button
            onClick={() => setActiveTab('standings')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'standings'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🏆 Standings
          </button>
          <button
            onClick={() => setActiveTab('injuries')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'injuries'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🏥 Injuries
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'chat'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            💬 Chat
          </button>
          <button
            onClick={() => setActiveTab('leagueSettings')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'leagueSettings'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            ⚙️ League
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <Suspense
        fallback={
          <div className="flex justify-center items-center py-12">
            <div className="text-center text-gray-400">Loading view...</div>
          </div>
        }
      >
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
    </div>
    );
  } catch (error) {
    console.error('Error rendering app:', error);
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-red-900/50 border border-red-600 p-6 rounded-lg">
          <h2 className="text-white font-bold text-xl mb-2">⚠️ Rendering Error</h2>
          <p className="text-red-200 mb-4">
            Something went wrong. Check the console for details.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }
}

export default App
