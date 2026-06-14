import { GlassCard } from '../ui/GlassCard';
import { Badge } from '../ui/Badge';
import type { LivePlayerStats } from '../../utils/liveStats';

import type { GroupedGame } from './types';

interface GameCardProps {
  game: GroupedGame;
  liveStats: LivePlayerStats[];
}

export function GameCard({ game, liveStats }: GameCardProps) {
  // Check if this game is live or final
  const gameLiveStats = game.players
    .map((p) => liveStats.find((stat) => stat.playerId === p.playerId))
    .filter((stat): stat is LivePlayerStats => Boolean(stat));

  // Use gameState from schedule API (always available) or fall back to liveStats
  const gameState = game.gameState || gameLiveStats[0]?.gameState;
  const isFinal = gameState === 'FINAL' || gameState === 'OFF';
  const isLive = gameLiveStats.length > 0 || gameState === 'LIVE' || isFinal;

  const scoringPlayersCount = isFinal
    ? game.players.filter((p) => {
      const stats = gameLiveStats.find((s) => s.playerId === p.playerId);
      return stats && stats.points > 0;
    }).length
    : game.players.length;

  const hasNoScorers = isFinal && scoringPlayersCount === 0;

  return (
    <GlassCard
      className={`p-4 transition-all ${isLive && !isFinal
        ? 'border-red-500/50 shadow-lg shadow-red-900/20'
        : isFinal
          ? 'border-green-500/30 opacity-90'
          : 'hover:border-blue-500/50'
        }`}
    >
      {/* Game Header with Team Logos (LARGER) */}
      <div className="flex items-center justify-between mb-4 relative">
        <img
          src={`https://assets.nhle.com/logos/nhl/svg/${game.awayTeam}_dark.svg`}
          alt={game.awayTeam}
          className="w-12 h-12 drop-shadow-md"
        />
        <div className="text-center flex-1 px-2">
          {isLive ? (
            <>
              {/* LIVE: Show score and period */}
              <div className="flex items-center justify-center gap-2 mb-1">
                <Badge variant={isFinal ? 'success' : 'danger'} className={!isFinal ? 'animate-pulse' : ''}>
                  {isFinal ? 'FINAL' : 'LIVE'}
                </Badge>
              </div>
              <p className="text-white font-black text-xl tracking-tight">
                {game.awayTeam} <span className="text-slate-400 mx-1">{gameLiveStats[0]?.awayScore || game.awayScore || 0}</span> - <span className="text-slate-400 mx-1">{gameLiveStats[0]?.homeScore || game.homeScore || 0}</span> {game.homeTeam}
              </p>
              {!isFinal && gameLiveStats[0]?.period > 0 && (
                <p className="text-red-400 text-xs mt-1 font-bold">
                  P{gameLiveStats[0].period} • {gameLiveStats[0].clock || ''}
                </p>
              )}
            </>
          ) : (
            <>
              {/* UPCOMING: Show game time */}
              <p className="text-slate-500 text-xs uppercase tracking-wider font-bold mb-1">Game Time</p>
              <p className="text-white font-bold text-lg">{game.gameTime}</p>
            </>
          )}
        </div>
        <img
          src={`https://assets.nhle.com/logos/nhl/svg/${game.homeTeam}_dark.svg`}
          alt={game.homeTeam}
          className="w-12 h-12 drop-shadow-md"
        />
      </div>

      {/* Matchup Text (only show if not live) */}
      {!isLive && (
        <p className="text-center text-slate-300 font-medium text-sm mb-4 bg-slate-800/30 py-1 rounded">
          {game.awayTeam} <span className="text-slate-500">@</span> {game.homeTeam}
        </p>
      )}

      {/* Your Players */}
      <div className="border-t border-slate-700/50 pt-3 mt-2">
        {/* Only show "Your Players" header if there are scorers OR game isn't final */}
        {!hasNoScorers && (
          <p className="text-slate-400 text-xs mb-2 font-medium">
            Your Players ({scoringPlayersCount}):
          </p>
        )}

        {/* Show message if FINAL game with 0 scoring players */}
        {hasNoScorers ? (
          <div className="text-center py-2 bg-slate-800/20 rounded">
            <p className="text-slate-500 text-xs">No points scored</p>
          </div>
        ) : isLive ? (
          /* LIVE: Show stats table */
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="text-left p-2 text-slate-400 font-medium">Player</th>
                  <th className="text-center p-2 text-slate-400 font-medium">G</th>
                  <th className="text-center p-2 text-slate-400 font-medium">A</th>
                  <th className="text-center p-2 text-slate-400 font-medium">H</th>
                  <th className="text-center p-2 text-slate-400 font-medium">BS</th>
                  <th className="text-center p-2 text-slate-400 font-medium">F</th>
                  <th className="text-center p-2 text-slate-400 font-medium">Pts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {game.players
                  .filter((player) => {
                    // For FINAL games, only show players with points
                    if (isFinal) {
                      const stats = gameLiveStats.find((s) => s.playerId === player.playerId);
                      return stats && stats.points > 0;
                    }
                    return true; // Show all players for live games
                  })
                  .map((player) => {
                    const stats = gameLiveStats.find((s) => s.playerId === player.playerId);
                    return (
                      <tr key={player.playerId} className="hover:bg-slate-800/30">
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <img
                              src={`https://assets.nhle.com/mugs/nhl/20242025/${player.teamAbbrev}/${player.playerId}.png`}
                              alt={player.playerName}
                              onError={(e) => {
                                e.currentTarget.src = 'https://assets.nhle.com/mugs/nhl/default-skater.png';
                              }}
                              className="w-6 h-6 rounded-full bg-slate-800 border border-slate-600"
                            />
                            <span className="text-white font-medium">{player.playerName}</span>
                          </div>
                        </td>
                        <td className="p-2 text-center text-slate-300">{stats?.goals || 0}</td>
                        <td className="p-2 text-center text-slate-300">{stats?.assists || 0}</td>
                        <td className="p-2 text-center text-slate-400">{stats?.hits || 0}</td>
                        <td className="p-2 text-center text-slate-400">{stats?.blockedShots || 0}</td>
                        <td className="p-2 text-center text-slate-400">{stats?.fights || 0}</td>
                        <td className="p-2 text-center">
                          <span className="text-green-400 font-bold">
                            {stats?.points ? `+${stats.points.toFixed(2)}` : '0.00'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        ) : (
          /* UPCOMING: Show player avatars */
          <div className="flex flex-wrap gap-2">
            {game.players.map((player) => (
              <div
                key={player.playerId}
                className="flex items-center gap-2 bg-slate-800/50 px-2 py-1.5 rounded-full border border-slate-700 hover:border-slate-500 transition-colors"
              >
                <img
                  src={`https://assets.nhle.com/mugs/nhl/20242025/${player.teamAbbrev}/${player.playerId}.png`}
                  alt={player.playerName}
                  onError={(e) => {
                    e.currentTarget.src = 'https://assets.nhle.com/mugs/nhl/default-skater.png';
                  }}
                  className="w-5 h-5 rounded-full bg-slate-700"
                />
                <span className="text-slate-200 text-xs font-medium">{player.playerName}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
