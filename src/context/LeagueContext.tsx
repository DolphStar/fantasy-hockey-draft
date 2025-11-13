import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { db } from '../firebase';
import { doc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import type { League, LeagueTeam, CreateLeagueData } from '../types/league';

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
        // Check localStorage first
        const savedLeagueId = localStorage.getItem('currentLeagueId');
        if (savedLeagueId) {
          setCurrentLeagueId(savedLeagueId);
          return;
        }

        // Otherwise, search for league containing this user's UID
        const { collection, getDocs } = await import('firebase/firestore');
        const leaguesRef = collection(db, 'leagues');
        
        // Get all leagues (for now - could optimize later)
        const snapshot = await getDocs(leaguesRef);
        
        for (const doc of snapshot.docs) {
          const leagueData = doc.data() as Omit<League, 'id'>;
          const userTeam = leagueData.teams.find(team => team.ownerUid === user.uid);
          
          if (userTeam) {
            console.log('Found user league:', doc.id, 'as team:', userTeam.teamName);
            setCurrentLeagueId(doc.id);
            localStorage.setItem('currentLeagueId', doc.id);
            return;
          }
        }
        
        console.log('No league found for user UID:', user.uid);
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

    const leagueDocRef = doc(db, 'leagues', currentLeagueId);

    const unsubscribe = onSnapshot(
      leagueDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setLeague({ id: snapshot.id, ...snapshot.data() } as League);
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
      const leagueId = `league-${Date.now()}`;
      
      // Default scoring rules (as per your rules)
      const defaultScoringRules = {
        // Skaters
        goal: 1,
        assist: 1,
        shortHandedGoal: 1,
        overtimeGoal: 1,
        fight: 2,
        // Defense
        blockedShot: 0.15,
        hit: 0.1,
        // Goalies
        win: 1,
        shutout: 2,
        save: 0.04,
        goalieAssist: 1,
        goalieGoal: 20,
        goalieFight: 5,
      };
      
      // Default roster settings: 9F / 6D / 2G / 5 reserves
      const defaultRosterSettings = {
        forwards: 9,
        defensemen: 6,
        goalies: 2,
        reserves: 5,
      };
      
      const leagueData: Omit<League, 'id'> = {
        leagueName: data.leagueName,
        admin: user.uid,
        status: 'pending',
        teams: data.teams,
        draftRounds: data.draftRounds || 15,
        scoringRules: defaultScoringRules,
        rosterSettings: defaultRosterSettings,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'leagues', leagueId), leagueData);
      
      // Save this as the current league
      localStorage.setItem('currentLeagueId', leagueId);
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
      await updateDoc(doc(db, 'leagues', leagueId), {
        ...updates,
        updatedAt: new Date().toISOString(),
      });
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
      await updateDoc(doc(db, 'leagues', leagueId), {
        status: 'live',
        updatedAt: new Date().toISOString(),
      });
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
