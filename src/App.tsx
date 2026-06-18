import { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import { Skeleton } from './components/ui/Skeleton';
import Login from './components/Login';
import LeagueLayout from './components/layout/LeagueLayout';
import LeagueIndexRedirect from './components/layout/LeagueIndexRedirect';
import Dashboard from './components/Dashboard';
import PlayersHub from './components/PlayersHub';
import LeaguesHub from './components/leagues/LeaguesHub';
import LeaguesBrowse from './components/leagues/LeaguesBrowse';
import CreateLeague from './components/leagues/CreateLeague';
import JoinByLink from './components/leagues/JoinByLink';
import { useAuth } from './context/AuthContext';
import { lazyWithRetry } from './utils/lazyWithRetry';

const PlayerList = lazyWithRetry(() => import('./components/PlayerList'));
const NHLRoster = lazyWithRetry(() => import('./components/NHLRoster'));
const DraftBoardGrid = lazyWithRetry(() => import('./components/DraftBoardGrid'));
const LeagueSettings = lazyWithRetry(() => import('./components/LeagueSettings'));
const Standings = lazyWithRetry(() => import('./components/Standings'));
const Injuries = lazyWithRetry(() => import('./components/Injuries'));

function App() {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-full max-w-md space-y-3 px-6">
          <Skeleton className="h-10 w-2/3 mx-auto" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center py-12">
          <div className="text-center text-gray-400">Loading view...</div>
        </div>
      }
    >
      <Routes>
        <Route path="/" element={<LeagueIndexRedirect />} />
        <Route path="/l/:leagueId" element={<LeagueLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="players" element={<PlayersHub />}>
            <Route index element={<PlayerList />} />
            <Route path="browse" element={<NHLRoster />} />
            <Route path="injuries" element={<Injuries />} />
          </Route>
          <Route path="scores" element={<Standings />} />
          <Route
            path="draft"
            element={
              <div className="max-w-6xl mx-auto px-6">
                <DraftBoardGrid />
              </div>
            }
          />
          <Route path="settings" element={<LeagueSettings />} />
        </Route>
        <Route path="/leagues" element={<LeaguesHub />} />
        <Route path="/leagues/browse" element={<LeaguesBrowse />} />
        <Route path="/leagues/new" element={<CreateLeague />} />
        <Route path="/join" element={<JoinByLink />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
