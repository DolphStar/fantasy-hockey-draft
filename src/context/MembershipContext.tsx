import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { useAuth } from './AuthContext';
import { listLeaguesForUser, type LeagueSummary } from '../services/leagueService';

interface MembershipContextType {
  memberships: LeagueSummary[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const MembershipContext = createContext<MembershipContextType | undefined>(undefined);

export function MembershipProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [memberships, setMemberships] = useState<LeagueSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!user) {
      setMemberships([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    listLeaguesForUser(user.uid)
      .then((leagues) => {
        if (cancelled) return;
        setMemberships(leagues);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Error loading memberships:', err);
        setError('Failed to load your leagues');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, nonce]);

  return (
    <MembershipContext.Provider
      value={{ memberships, loading, error, refresh: () => setNonce((n) => n + 1) }}
    >
      {children}
    </MembershipContext.Provider>
  );
}

export function useMemberships() {
  const context = useContext(MembershipContext);
  if (context === undefined) {
    throw new Error('useMemberships must be used within a MembershipProvider');
  }
  return context;
}
