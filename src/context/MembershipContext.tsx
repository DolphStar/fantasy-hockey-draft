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
  const [error, setError] = useState<string | null>(null);
  // The uid we've finished resolving memberships for. `undefined` = nothing resolved
  // yet; `null` = resolved the signed-out state.
  const [resolvedUid, setResolvedUid] = useState<string | null | undefined>(undefined);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    if (!user) {
      setMemberships([]);
      setError(null);
      setResolvedUid(null);
      return;
    }

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
        if (!cancelled) setResolvedUid(user.uid);
      });

    return () => {
      cancelled = true;
    };
  }, [user, nonce]);

  // Derived, not a separate `loading` state set inside the effect: we're loading until
  // memberships have been resolved for the *current* user. This closes the race where,
  // right after sign-in, a stale `loading === false` (left over from the signed-out
  // phase) let consumers redirect on empty memberships before the fetch had run — which
  // bounced signed-in users to /leagues instead of their league.
  const loading = resolvedUid !== (user?.uid ?? null);

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
