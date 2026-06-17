import { Navigate } from 'react-router-dom';

import { Skeleton } from '../ui/Skeleton';
import { useMemberships } from '../../context/MembershipContext';
import { getStoredLeagueId } from '../../services/leagueService';
import { buildLeaguePath, pickDefaultLeague } from '../../lib/leaguePaths';

export default function LeagueIndexRedirect() {
  const { memberships, loading } = useMemberships();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-full max-w-md space-y-3 px-6">
          <Skeleton className="h-10 w-2/3 mx-auto" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  const target = pickDefaultLeague(memberships, getStoredLeagueId());
  if (!target) return <Navigate to="/leagues" replace />;
  return <Navigate to={buildLeaguePath(target)} replace />;
}
