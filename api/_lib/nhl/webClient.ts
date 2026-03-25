/**
 * Direct NHL web API client for serverless (no Vite proxy).
 */

import type { PlayerGameStats } from '../../../packages/core/nhl/types';

export const NHL_WEB_API_BASE = 'https://api-web.nhle.com/v1';

function createHttpError(operation: string, url: string, response: Response): Error {
  const statusDetails = response.statusText
    ? `${response.status} ${response.statusText}`
    : String(response.status);
  const responseUrl = response.url || url;
  return new Error(`${operation} failed with HTTP ${statusDetails}: ${responseUrl}`);
}

export interface NhlScheduleGame {
  id: number;
  season: number;
  gameType: number;
  gameDate: string;
  awayTeam: {
    id: number;
    abbrev: string;
    score: number;
  };
  homeTeam: {
    id: number;
    abbrev: string;
    score: number;
  };
  gameState: string;
  gameOutcome: {
    lastPeriodType: string;
  };
}

export interface NhlBoxscore {
  gameId: number;
  awayTeam?: {
    abbrev?: string;
  };
  homeTeam?: {
    abbrev?: string;
  };
  playerByGameStats: {
    awayTeam: {
      forwards: PlayerGameStats[];
      defense: PlayerGameStats[];
      goalies: PlayerGameStats[];
    };
    homeTeam: {
      forwards: PlayerGameStats[];
      defense: PlayerGameStats[];
      goalies: PlayerGameStats[];
    };
  };
}

export async function getGamesForDate(date: string): Promise<NhlScheduleGame[]> {
  const url = `${NHL_WEB_API_BASE}/score/${date}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw createHttpError(`Failed to fetch games for ${date}`, url, response);
  }
  const data = (await response.json()) as { games?: NhlScheduleGame[] };
  return data.games || [];
}

export async function getGameBoxscore(gameId: number): Promise<NhlBoxscore> {
  const url = `${NHL_WEB_API_BASE}/gamecenter/${gameId}/boxscore`;
  const response = await fetch(url);
  if (!response.ok) {
    throw createHttpError(`Failed to fetch boxscore for game ${gameId}`, url, response);
  }
  return (await response.json()) as NhlBoxscore;
}

export async function getGamePlayByPlay(gameId: number): Promise<unknown> {
  const url = `${NHL_WEB_API_BASE}/gamecenter/${gameId}/play-by-play`;
  const response = await fetch(url);
  if (!response.ok) {
    throw createHttpError(`Failed to fetch play-by-play for game ${gameId}`, url, response);
  }
  return response.json();
}

export function getAllPlayersFromBoxscore(boxscore: NhlBoxscore): PlayerGameStats[] {
  const players: PlayerGameStats[] = [];

  if (!boxscore.playerByGameStats) {
    return players;
  }

  const { awayTeam, homeTeam } = boxscore.playerByGameStats;
  const awayTeamAbbrev = boxscore.awayTeam?.abbrev || 'UNK';
  const homeTeamAbbrev = boxscore.homeTeam?.abbrev || 'UNK';

  if (awayTeam) {
    const awayPlayers = [
      ...(awayTeam.forwards || []),
      ...(awayTeam.defense || []),
      ...(awayTeam.goalies || []),
    ];
    awayPlayers.forEach((player) => {
      player.teamAbbrev = awayTeamAbbrev;
    });
    players.push(...awayPlayers);
  }

  if (homeTeam) {
    const homePlayers = [
      ...(homeTeam.forwards || []),
      ...(homeTeam.defense || []),
      ...(homeTeam.goalies || []),
    ];
    homePlayers.forEach((player) => {
      player.teamAbbrev = homeTeamAbbrev;
    });
    players.push(...homePlayers);
  }

  return players;
}
