import { useState, useEffect } from 'react'
import PlayerList from './components/PlayerList'
import NHLRoster from './components/NHLRoster'
import DraftBoard from './components/DraftBoard'
import LeagueSettings from './components/LeagueSettings'
import Standings from './components/Standings'
import Login from './components/Login'
import { useAuth } from './context/AuthContext'

type Tab = 'roster' | 'myPlayers' | 'draftBoard' | 'standings' | 'leagueSettings'

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('roster')
  const { user, loading: authLoading, signOut } = useAuth()
  
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
        <div className="flex gap-4 border-b border-gray-700">
          <button
            onClick={() => setActiveTab('roster')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'roster'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            NHL Rosters
          </button>
          <button
            onClick={() => setActiveTab('draftBoard')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'draftBoard'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Draft Board
          </button>
          <button
            onClick={() => setActiveTab('myPlayers')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'myPlayers'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            My Players
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
      {activeTab === 'roster' && <NHLRoster />}
      {activeTab === 'draftBoard' && <DraftBoard />}
      {activeTab === 'myPlayers' && <PlayerList />}
      {activeTab === 'standings' && <Standings />}
      {activeTab === 'leagueSettings' && <LeagueSettings />}
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
