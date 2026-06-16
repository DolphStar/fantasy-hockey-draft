import { useEffect } from 'react';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { LeagueProvider } from '../../context/LeagueContext';
import { DraftProvider } from '../../context/DraftContext';
import { useMemberships } from '../../context/MembershipContext';
import { Skeleton } from '../ui/Skeleton';
import AppShell from './AppShell';

export default function LeagueLayout() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const { memberships, loading } = useMemberships();
  const navigate = useNavigate();

  const isMember = !!leagueId && memberships.some((m) => m.id === leagueId);

  useEffect(() => {
    if (!loading && leagueId && !isMember) {
      toast.error('League not available');
      navigate('/', { replace: true });
    }
  }, [loading, leagueId, isMember, navigate]);

  if (loading || !isMember) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-full max-w-md space-y-3 px-6">
          <Skeleton className="h-10 w-2/3 mx-auto" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  return (
    <LeagueProvider>
      <DraftProvider>
        <AppShell>
          <Outlet />
        </AppShell>
      </DraftProvider>
    </LeagueProvider>
  );
}
