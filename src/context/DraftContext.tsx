import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, onSnapshot, updateDoc, collection, query, getDocs, deleteDoc } from 'firebase/firestore';
import { createInitialDraftState, getCurrentPick, isTeamsTurn } from '../utils/draftLogic';
import type { DraftState } from '../utils/draftLogic';
import { useAuth } from './AuthContext';
import { useLeague } from './LeagueContext';

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

    // Use league ID to create separate draft for each league
    const draftDocRef = doc(db, 'drafts', league.id);

    const initializeDraft = async () => {
      try {
        const draftDoc = await getDoc(draftDocRef);

        if (!draftDoc.exists()) {
          // Create initial draft state using league teams
          const teamNames = league.teams.map(t => t.teamName);
          const initialState = createInitialDraftState(teamNames, league.draftRounds);
          await setDoc(draftDocRef, initialState);
          setDraftState(initialState);
        } else {
          setDraftState(draftDoc.data() as DraftState);
        }
      } catch (err) {
        console.error('Error initializing draft:', err);
        setError('Failed to initialize draft');
      } finally {
        setLoading(false);
      }
    };

    initializeDraft();

    // Listen to real-time updates
    const unsubscribe = onSnapshot(
      draftDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setDraftState(snapshot.data() as DraftState);
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
      const nextPickNumber = draftState.currentPickNumber + 1;
      const isComplete = nextPickNumber > draftState.totalPicks;

      await updateDoc(doc(db, 'drafts', league.id), {
        currentPickNumber: nextPickNumber,
        isComplete
      });
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
      
      // 1. Delete all drafted players
      const playersQuery = query(collection(db, 'draftedPlayers'));
      const playersSnapshot = await getDocs(playersQuery);
      
      const deletePlayersPromises = playersSnapshot.docs.map(playerDoc => 
        deleteDoc(doc(db, 'draftedPlayers', playerDoc.id))
      );
      await Promise.all(deletePlayersPromises);
      console.log(`✓ Deleted ${playersSnapshot.docs.length} drafted players`);
      
      // 2. Delete all player performance stats (daily scores)
      const scoresPath = `leagues/${league.id}/playerDailyScores`;
      const scoresQuery = query(collection(db, scoresPath));
      const scoresSnapshot = await getDocs(scoresQuery);
      
      const deleteScoresPromises = scoresSnapshot.docs.map(scoreDoc => 
        deleteDoc(doc(db, scoresPath, scoreDoc.id))
      );
      await Promise.all(deleteScoresPromises);
      console.log(`✓ Deleted ${scoresSnapshot.docs.length} player performance stats`);
      
      // 3. Delete all team scores
      const teamScoresPath = `leagues/${league.id}/teamScores`;
      const teamScoresQuery = query(collection(db, teamScoresPath));
      const teamScoresSnapshot = await getDocs(teamScoresQuery);
      
      const deleteTeamScoresPromises = teamScoresSnapshot.docs.map(scoreDoc => 
        deleteDoc(doc(db, teamScoresPath, scoreDoc.id))
      );
      await Promise.all(deleteTeamScoresPromises);
      console.log(`✓ Deleted ${teamScoresSnapshot.docs.length} team scores`);
      
      // 4. Delete all live stats
      const liveStatsPath = `leagues/${league.id}/liveStats`;
      const liveStatsQuery = query(collection(db, liveStatsPath));
      const liveStatsSnapshot = await getDocs(liveStatsQuery);
      
      const deleteLiveStatsPromises = liveStatsSnapshot.docs.map(statDoc => 
        deleteDoc(doc(db, liveStatsPath, statDoc.id))
      );
      await Promise.all(deleteLiveStatsPromises);
      console.log(`✓ Deleted ${liveStatsSnapshot.docs.length} live stats`);
      
      // 5. Reset the draft state
      const teamNames = league.teams.map(t => t.teamName);
      const initialState = createInitialDraftState(teamNames, league.draftRounds);
      await setDoc(doc(db, 'drafts', league.id), initialState);
      console.log('✓ Reset draft state');
      
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
