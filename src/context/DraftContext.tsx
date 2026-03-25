import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { getCurrentPick, isTeamsTurn } from '../utils/draftLogic';
import type { DraftState } from '../utils/draftLogic';
import { useAuth } from './AuthContext';
import { useLeague } from './LeagueContext';
import {
  advanceDraftState,
  ensureDraftState,
  resetDraftForLeague,
  subscribeToDraftState,
} from '../services/draftService';

interface DraftContextType {
  draftState: DraftState | null;
  loading: boolean;
  error: string | null;
  currentPick: ReturnType<typeof getCurrentPick>;
  isMyTurn: boolean;
  advancePick: () => Promise<void>;
  resetDraft: () => Promise<void>;
}

const DraftContext = createContext<DraftContextType | undefined>(undefined);

export function DraftProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { league, loading: leagueLoading } = useLeague();
  const [draftState, setDraftState] = useState<DraftState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize or fetch draft state from Firebase
  useEffect(() => {
    // Wait for league to load
    if (leagueLoading || !league) {
      setLoading(leagueLoading);
      return;
    }

    const initializeDraft = async () => {
      try {
        setDraftState(await ensureDraftState(league));
      } catch (err) {
        console.error('Error initializing draft:', err);
        setError('Failed to initialize draft');
      } finally {
        setLoading(false);
      }
    };

    initializeDraft();

    // Listen to real-time updates
    const unsubscribe = subscribeToDraftState(
      league.id,
      (nextDraftState) => {
        if (nextDraftState) {
          setDraftState(nextDraftState);
        }
      },
      (err) => {
        console.error('Error listening to draft updates:', err);
        setError('Failed to sync draft state');
      }
    );

    return () => unsubscribe();
  }, [league, leagueLoading]);

  // Advance to the next pick
  const advancePick = async () => {
    if (!draftState || !league) return;

    try {
      await advanceDraftState(league.id, draftState);
    } catch (err) {
      console.error('Error advancing pick:', err);
      throw err;
    }
  };

  // Reset the draft (useful for testing)
  const resetDraft = async () => {
    if (!league) return;
    
    try {
      console.log('Starting draft reset...');
      await resetDraftForLeague(league);
      
      console.log('✅ Draft reset complete!');
    } catch (err) {
      console.error('Error resetting draft:', err);
      throw err;
    }
  };

  // Determine current pick and if it's user's turn
  const currentPick = draftState ? getCurrentPick(draftState) : null;
  
  // Find user's team name from league
  const myTeam = league?.teams.find(t => t.ownerUid === user?.uid);
  const myTeamName = myTeam?.teamName || '';
  const isMyTurn = draftState && myTeamName ? isTeamsTurn(draftState, myTeamName) : false;

  return (
    <DraftContext.Provider
      value={{
        draftState,
        loading,
        error,
        currentPick,
        isMyTurn,
        advancePick,
        resetDraft
      }}
    >
      {children}
    </DraftContext.Provider>
  );
}

export function useDraft() {
  const context = useContext(DraftContext);
  if (context === undefined) {
    throw new Error('useDraft must be used within a DraftProvider');
  }
  return context;
}
