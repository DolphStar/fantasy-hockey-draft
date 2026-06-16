import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';

import { useAuth } from './AuthContext';
import type { League, LeagueTeam, CreateLeagueData } from '../types/league';
import {
  createLeague as createLeagueRecord,
  startLeagueDraft,
  storeCurrentLeagueId,
  subscribeToLeague,
  updateLeagueDocument,
} from '../services/leagueService';

interface LeagueContextType {
  league: League | null;
  loading: boolean;
  error: string | null;
  isAdmin: boolean;
  myTeam: LeagueTeam | null;
  createLeague: (data: CreateLeagueData) => Promise<string>;
  updateLeague: (leagueId: string, updates: Partial<League>) => Promise<void>;
  startDraft: (leagueId: string) => Promise<void>;
}

const LeagueContext = createContext<LeagueContextType | undefined>(undefined);

export function LeagueProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { leagueId } = useParams<{ leagueId: string }>();
  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!leagueId) {
      setLeague(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    storeCurrentLeagueId(leagueId);

    const unsubscribe = subscribeToLeague(
      leagueId,
      (nextLeague) => {
        setLeague(nextLeague);
        if (!nextLeague) setError('League not found');
        else setError(null);
        setLoading(false);
      },
      (err) => {
        console.error('Error loading league:', err);
        setError('Failed to load league');
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [leagueId]);

  const createLeague = async (data: CreateLeagueData): Promise<string> => {
    if (!user) throw new Error('Must be signed in to create a league');
    return createLeagueRecord(user, data);
  };

  const updateLeague = async (id: string, updates: Partial<League>) => {
    await updateLeagueDocument(id, updates, league?.admin);
  };

  const startDraft = async (id: string) => {
    if (!user || league?.admin !== user.uid) {
      throw new Error('Only the admin can start the draft');
    }
    await startLeagueDraft(id);
  };

  const isAdmin = user ? league?.admin === user.uid : false;
  const myTeam = league?.teams.find((team) => team.ownerUid === user?.uid) || null;

  return (
    <LeagueContext.Provider
      value={{ league, loading, error, isAdmin, myTeam, createLeague, updateLeague, startDraft }}
    >
      {children}
    </LeagueContext.Provider>
  );
}

export function useLeague() {
  const context = useContext(LeagueContext);
  if (context === undefined) {
    throw new Error('useLeague must be used within a LeagueProvider');
  }
  return context;
}
