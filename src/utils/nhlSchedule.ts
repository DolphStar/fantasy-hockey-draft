/**
 * NHL Schedule Module
 * 
 * Fetches and parses NHL game schedules to show player matchups.
 * Uses "hockey day" logic - the day doesn't change until 3 AM ET
 * to ensure late-night games are still visible.
 * 
 * @module utils/nhlSchedule
 */

import { HOCKEY_DAY_CUTOFF_HOUR } from '../constants';

/** NHL game data from schedule API */
interface Game {
  id: number;
  startTimeUTC: string;
  awayTeam: { abbrev: string; placeName: { default: string }; score?: number };
  homeTeam: { abbrev: string; placeName: { default: string }; score?: number };
  gameState: string;
}

/** A single day's schedule */
interface ScheduleDay {
  date: string;
  games: Game[];
}

/** Full schedule API response */
interface ScheduleResponse {
  gameWeek: ScheduleDay[];
}

/**
 * Player's game matchup information
 * Used to display "Today's Matchups" on Dashboard and LiveStats
 */
export interface PlayerMatchup {
  /** NHL player ID */
  playerId: number;
  /** Player's full name */
  playerName: string;
  /** Player's NHL team abbreviation */
  teamAbbrev: string;
  /** Opponent team abbreviation */
  opponent: string;
  /** Whether player's team is home */
  isHome: boolean;
  /** Formatted game time in user's timezone */
  gameTime: string;
  /** Raw UTC game time */
  gameTimeUTC: string;
  /** Game state: "FUT", "LIVE", "FINAL", etc. */
  gameState: string;
  /** NHL game ID */
  gameId: number;
  /** Away team score (if game started) */
  awayScore?: number;
  /** Home team score (if game started) */
  homeScore?: number;
}

/**
 * Fetches today's NHL schedule from the API
 * 
 * Uses "hockey day" logic: before 3 AM ET, returns yesterday's games
 * to ensure late-night games are still visible until they finish.
 * 
 * @returns Promise with array of today's games
 */
export async function fetchTodaySchedule(): Promise<Game[]> {
  try {
    // Use our serverless function to avoid CORS issues
    const response = await fetch('/api/nhl-schedule');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data: ScheduleResponse = await response.json();
    
    // Get current hour in Eastern Time
    const now = new Date();
    const etHour = parseInt(now.toLocaleString('en-US', { 
      timeZone: 'America/New_York', 
      hour: 'numeric', 
      hour12: false 
    }));
    
    // "Hockey day" logic: before 3 AM ET, use yesterday's date
    // This ensures we show today's games until they're all done
    let targetDate: string;
    if (etHour < HOCKEY_DAY_CUTOFF_HOUR) {
      // Before 3 AM ET - still show "yesterday's" games
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      targetDate = yesterday.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      console.log(`📅 Before 3 AM ET - using yesterday's date: ${targetDate}`);
    } else {
      // After 3 AM ET - show today's games
      targetDate = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    }
    
    // Find games for target date
    const schedule = data.gameWeek.find(day => day.date === targetDate);
    
    return schedule?.games || [];
  } catch (error) {
    console.error('Error fetching NHL schedule:', error);
    return [];
  }
}

/**
 * Fetches NHL schedule for a specific date
 * 
 * @param dateStr - Date in YYYY-MM-DD format
 * @returns Promise with array of games for that date
 */
export async function fetchScheduleForDate(dateStr: string): Promise<Game[]> {
  try {
    const response = await fetch('/api/nhl-schedule');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data: ScheduleResponse = await response.json();
    
    // Find games for the specified date
    const schedule = data.gameWeek.find(day => day.date === dateStr);
    
    return schedule?.games || [];
  } catch (error) {
    console.error(`Error fetching NHL schedule for ${dateStr}:`, error);
    return [];
  }
}

/**
 * Maps a user's roster to their game matchups for today
 * 
 * For each player in the roster, finds if they have a game today
 * and returns matchup details including opponent, game time, and scores.
 * 
 * @param roster - Array of player objects with playerId, name, and nhlTeam
 * @param todaysGames - Array of games from fetchTodaySchedule()
 * @returns Array of PlayerMatchup objects, sorted by game time
 * 
 * @example
 * ```typescript
 * const games = await fetchTodaySchedule();
 * const matchups = getUpcomingMatchups(myRoster, games);
 * // Returns: [{ playerName: "MacKinnon", opponent: "TOR", gameTime: "7:00 PM EST", ... }]
 * ```
 */
export function getUpcomingMatchups(
  roster: Array<{ playerId: number; name: string; nhlTeam: string }>,
  todaysGames: Game[]
): PlayerMatchup[] {
  if (todaysGames.length === 0) return [];

  const matchups = roster
    .map(player => {
      // Find a game where this player's team is either home or away
      const game = todaysGames.find(
        g => 
          g.awayTeam.abbrev === player.nhlTeam || 
          g.homeTeam.abbrev === player.nhlTeam
      );

      if (!game) return null; // Player has no game today

      // Determine if home or away
      const isHome = game.homeTeam.abbrev === player.nhlTeam;
      const opponent = isHome ? game.awayTeam.abbrev : game.homeTeam.abbrev;
      
      // Convert UTC time to local time
      const gameDate = new Date(game.startTimeUTC);
      const gameTime = gameDate.toLocaleTimeString([], { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true,
        timeZoneName: 'short'
      });

      return {
        playerId: player.playerId,
        playerName: player.name,
        teamAbbrev: player.nhlTeam,
        opponent,
        isHome,
        gameTime,
        gameTimeUTC: game.startTimeUTC,
        gameState: game.gameState,
        gameId: game.id,
        awayScore: game.awayTeam.score,
        homeScore: game.homeTeam.score
      };
    })
    .filter(m => m !== null) as PlayerMatchup[];

  // Sort by game time
  matchups.sort((a, b) => 
    new Date(a.gameTimeUTC).getTime() - new Date(b.gameTimeUTC).getTime()
  );

  return matchups;
}
