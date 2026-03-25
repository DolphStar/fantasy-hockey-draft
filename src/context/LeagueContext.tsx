import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import type { League, LeagueTeam, CreateLeagueData } from '../types/league';
import {
  createLeague as createLeagueRecord,
  findLeagueIdForUser,
  startLeagueDraft,
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
  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auto-discover user's league
  const [currentLeagueId, setCurrentLeagueId] = useState<string | null>(null);

  // Find the league that contains this user's UID
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const findUserLeague = async () => {
      try {
        const leagueId = await findLeagueIdForUser(user.uid);
        if (leagueId) {
          setCurrentLeagueId(leagueId);
          return;
        }

        setLoading(false);
      } catch (err) {
        console.error('Error finding user league:', err);
        setError('Failed to find league');
        setLoading(false);
      }
    };

    findUserLeague();
  }, [user]);

  // Load league data in real-time
  useEffect(() => {
    if (!currentLeagueId) {
      return;
    }

    const unsubscribe = subscribeToLeague(
      currentLeagueId,
      (nextLeague) => {
        if (nextLeague) {
          setLeague(nextLeague);
        } else {
          setLeague(null);
          setError('League not found');
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error loading league:', err);
        setError('Failed to load league');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentLeagueId]);

  // Create a new league
  const createLeague = async (data: CreateLeagueData): Promise<string> => {
    if (!user) throw new Error('Must be signed in to create a league');

    try {
      const leagueId = await createLeagueRecord(user, data);
      setCurrentLeagueId(leagueId);
      return leagueId;
    } catch (err) {
      console.error('Error creating league:', err);
      throw err;
    }
  };

  // Update league
  const updateLeague = async (leagueId: string, updates: Partial<League>) => {
    try {
      await updateLeagueDocument(leagueId, updates, league?.admin);
    } catch (err) {
      console.error('Error updating league:', err);
      throw err;
    }
  };

  // Start the draft (change status to "live")
  const startDraft = async (leagueId: string) => {
    if (!user || league?.admin !== user.uid) {
      throw new Error('Only the admin can start the draft');
    }

    try {
      await startLeagueDraft(leagueId);
    } catch (err) {
      console.error('Error starting draft:', err);
      throw err;
    }
  };

  const isAdmin = user ? league?.admin === user.uid : false;
  const myTeam = league?.teams.find(team => team.ownerUid === user?.uid) || null;

  return (
    <LeagueContext.Provider
      value={{
        league,
        loading,
        error,
        isAdmin,
        myTeam,
        createLeague,
        updateLeague,
        startDraft,
      }}
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
