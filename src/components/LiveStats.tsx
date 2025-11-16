import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { useLeague } from '../context/LeagueContext';
import { processLiveStats } from '../utils/liveStats';
import type { LivePlayerStats } from '../utils/liveStats';
import { fetchTodaySchedule, getUpcomingMatchups, type PlayerMatchup } from '../utils/nhlSchedule';

export default function LiveStats() {
  const { league, myTeam } = useLeague();
  const [liveStats, setLiveStats] = useState<LivePlayerStats[]>([]);
  const [upcomingMatchups, setUpcomingMatchups] = useState<PlayerMatchup[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(300); // 5 minutes

  // Real-time listener for live stats
  useEffect(() => {
    if (!league) {
      setLoading(false);
      return;
    }

    // Get today's date in Eastern Time (NHL's timezone)
    // Convert current time to ET (UTC-5 or UTC-4 depending on DST)
    const now = new Date();
    const etOffset = -5; // EST is UTC-5 (adjust to -4 for EDT if needed)
    const etTime = new Date(now.getTime() + (etOffset * 60 * 60 * 1000));
    const year = etTime.getUTCFullYear();
    const month = String(etTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(etTime.getUTCDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`;
    const liveStatsRef = collection(db, `leagues/${league.id}/liveStats`);

    // Set up real-time listener
    const unsubscribe = onSnapshot(liveStatsRef, (snapshot) => {
      const stats: LivePlayerStats[] = [];
      
      snapshot.forEach(doc => {
        // Only include today's stats
        if (doc.id.startsWith(today)) {
          stats.push(doc.data() as LivePlayerStats);
        }
      });

      // Sort by points descending
      stats.sort((a, b) => b.points - a.points);
      
      setLiveStats(stats);
      setLastUpdate(new Date());
      setLoading(false);
    });

    return () => unsubscribe();
  }, [league]);

  // Fetch upcoming matchups (always, not just when no live stats)
  useEffect(() => {
    if (!league || !myTeam) return;

    const fetchMatchups = async () => {
      try {
        // Fetch today's schedule
        const todaysGames = await fetchTodaySchedule();
        
        // Get user's roster from drafted players (ONLY YOUR TEAM)
        const draftedPlayersSnapshot = await onSnapshot(
          collection(db, 'draftedPlayers'),
          (snapshot) => {
            const roster = snapshot.docs
              .filter(doc => {
                const data = doc.data();
                return (
                  data.leagueId === league.id && 
                  data.rosterSlot === 'active' &&
                  data.draftedByTeam === myTeam.teamName  // ← FILTER BY YOUR TEAM!
                );
              })
              .map(doc => {
                const data = doc.data();
                return {
                  playerId: data.playerId,
                  name: data.name,
                  nhlTeam: data.nhlTeam
                };
              });

            // Get matchups for user's roster
            const matchups = getUpcomingMatchups(roster, todaysGames);
            setUpcomingMatchups(matchups);
          }
        );

        return () => draftedPlayersSnapshot();
      } catch (error) {
        console.error('Error fetching matchups:', error);
      }
    };

    fetchMatchups();
  }, [league, myTeam]);

  // Auto-refresh countdown timer
  useEffect(() => {
    const countdown = setInterval(() => {
      setSecondsUntilRefresh(prev => {
        if (prev <= 1) {
          return 300; // Reset to 5 minutes
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdown);
  }, []);

  // Auto-refresh live stats every 5 minutes
  useEffect(() => {
    if (!league) return;

    const autoRefresh = setInterval(async () => {
      console.log('🔄 Auto-refreshing live stats...');
      setRefreshing(true);
      try {
        await processLiveStats(league.id);
        setSecondsUntilRefresh(300); // Reset countdown
      } catch (error) {
        console.error('Auto-refresh failed:', error);
      } finally {
        setRefreshing(false);
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(autoRefresh);
  }, [league]);

  // Manual refresh function
  const handleManualRefresh = async () => {
    if (!league || refreshing) return;
    
    setRefreshing(true);
    try {
      await processLiveStats(league.id);
      setSecondsUntilRefresh(300); // Reset countdown
    } catch (error) {
      console.error('Manual refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Format countdown timer
  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Group stats by team
  const statsByTeam = liveStats.reduce((acc, stat) => {
    if (!acc[stat.teamName]) {
      acc[stat.teamName] = [];
    }
    acc[stat.teamName].push(stat);
    return acc;
  }, {} as Record<string, LivePlayerStats[]>);

  if (!league) {
    return null;
  }

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden mt-6">
      <div className="p-6 pb-4 border-b border-gray-700">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-semibold text-white">🔴 Live Stats - Today's Games</h3>
            {liveStats.length > 0 && (
              <span className="animate-pulse bg-red-600 text-white text-xs px-2 py-1 rounded-full">
                LIVE
              </span>
            )}
            {refreshing && (
              <span className="animate-spin text-blue-400 text-lg">🔄</span>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            {/* Countdown Timer */}
            <div className="text-center">
              <p className="text-gray-400 text-xs">Next refresh in</p>
              <p className="text-green-400 text-sm font-mono font-bold">{formatCountdown(secondsUntilRefresh)}</p>
            </div>
            
            {/* Manual Refresh Button */}
            <button
              onClick={handleManualRefresh}
              disabled={refreshing}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                refreshing
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {refreshing ? 'Refreshing...' : '🔄 Refresh Now'}
            </button>
            
            {/* Last Updated */}
            {lastUpdate && (
              <div className="text-right">
                <p className="text-gray-400 text-xs">Last updated</p>
                <p className="text-gray-300 text-sm">{lastUpdate.toLocaleTimeString()}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-6">
          <p className="text-gray-400">Loading live stats...</p>
        </div>
      ) : (
        <>
          {/* Live Stats Section - Only show players with points > 0 */}
          {liveStats.length > 0 && (
            <div className="p-6 pt-0 space-y-6">
              {Object.entries(statsByTeam).map(([teamName, players]) => {
                // Filter to only show players with points > 0
                const playersWithPoints = players.filter(p => p.points > 0);
                
                if (playersWithPoints.length === 0) return null;
                
                const teamTotals = playersWithPoints.reduce(
                  (acc, p) => ({
                    goals: acc.goals + p.goals,
                    assists: acc.assists + p.assists,
                    points: acc.points + p.points,
                  }),
                  { goals: 0, assists: 0, points: 0 }
                );

                return (
                  <div key={teamName} className="bg-gray-750 rounded-lg overflow-hidden">
                    {/* Team Header */}
                    <div className="bg-gray-700 px-4 py-3 flex items-center justify-between">
                      <h4 className="text-lg font-bold text-white">{teamName}</h4>
                      <div className="text-right">
                        <p className="text-gray-400 text-xs">Today's Totals</p>
                        <p className="text-green-400 font-bold text-xl">
                          {teamTotals.points.toFixed(2)} Pts
                        </p>
                      </div>
                    </div>

                    {/* Player Stats Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-700/50">
                          <tr>
                            <th className="text-left p-3 text-gray-400 font-medium text-sm">Player</th>
                            <th className="text-center p-3 text-gray-400 font-medium text-sm">NHL</th>
                            <th className="text-center p-3 text-gray-400 font-medium text-sm">⚽ G</th>
                            <th className="text-center p-3 text-gray-400 font-medium text-sm">🎯 A</th>
                            <th className="text-center p-3 text-gray-400 font-medium text-sm">💥 H</th>
                            <th className="text-center p-3 text-gray-400 font-medium text-sm">🛡️ BS</th>
                            <th className="text-center p-3 text-gray-400 font-medium text-sm">🏆 W</th>
                            <th className="text-center p-3 text-gray-400 font-medium text-sm">🥅 Sv</th>
                            <th className="text-center p-3 text-gray-400 font-medium text-sm">📊 Pts</th>
                          </tr>
                        </thead>
                        <tbody>
                          {playersWithPoints.map((player, index) => (
                              <tr
                                key={`${player.playerId}-${index}`}
                                className="border-t border-gray-700 hover:bg-gray-700/30"
                              >
                                <td className="p-3">
                                  <span className="text-white font-medium">{player.playerName}</span>
                                </td>
                                <td className="p-3 text-center text-gray-300">{player.nhlTeam}</td>
                                <td className="p-3 text-center text-gray-300">{player.goals}</td>
                                <td className="p-3 text-center text-gray-300">{player.assists}</td>
                                <td className="p-3 text-center text-gray-300">{player.hits || 0}</td>
                                <td className="p-3 text-center text-gray-300">{player.blockedShots || 0}</td>
                                <td className="p-3 text-center text-gray-300">{player.wins || 0}</td>
                                <td className="p-3 text-center text-gray-300">{player.saves || 0}</td>
                                <td className="p-3 text-center">
                                  <span className="text-green-400 font-bold">+{player.points.toFixed(2)}</span>
                                </td>
                              </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Upcoming Matchups Section - Always show */}
          <div className={`p-6 ${liveStats.length > 0 ? 'border-t border-gray-700' : ''}`}>
            <div className="text-center py-4">
              <h4 className="text-lg font-bold text-white mb-2">🏒 Today's Matchups</h4>
              <p className="text-gray-400 text-sm mb-6">
                Your players' games for today
              </p>
            
            {upcomingMatchups.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-4xl mx-auto">
                {/* Group matchups by game (using sorted team abbrevs to avoid duplicates) */}
                {Object.entries(
                  upcomingMatchups.reduce((acc, matchup) => {
                    // Create a consistent game key regardless of which team the player is on
                    const teams = [matchup.teamAbbrev, matchup.opponent].sort();
                    const gameKey = `${teams[0]}-${teams[1]}-${matchup.gameTime}`;
                    
                    if (!acc[gameKey]) {
                      // Determine away/home teams (away team is listed first in NHL format)
                      const awayTeam = matchup.isHome ? matchup.opponent : matchup.teamAbbrev;
                      const homeTeam = matchup.isHome ? matchup.teamAbbrev : matchup.opponent;
                      
                      acc[gameKey] = {
                        awayTeam,
                        homeTeam,
                        gameTime: matchup.gameTime,
                        gameTimeUTC: matchup.gameTimeUTC,
                        gameState: matchup.gameState,
                        gameId: matchup.gameId,
                        awayScore: matchup.awayScore,
                        homeScore: matchup.homeScore,
                        players: []
                      };
                    }
                    acc[gameKey].players.push(matchup);
                    return acc;
                  }, {} as Record<string, any>)
                )
                // Sort: LIVE games first, then by time
                .sort(([, a], [, b]) => {
                  // Check if games are live by looking at player stats
                  const aIsLive = a.players.some((p: any) => 
                    liveStats.some(stat => stat.playerId === p.playerId)
                  );
                  const bIsLive = b.players.some((p: any) => 
                    liveStats.some(stat => stat.playerId === p.playerId)
                  );
                  
                  if (aIsLive && !bIsLive) return -1;
                  if (!aIsLive && bIsLive) return 1;
                  
                  // Both same state, sort by time
                  return new Date(a.gameTimeUTC).getTime() - new Date(b.gameTimeUTC).getTime();
                })
                .map(([gameKey, game]) => {
                  // Check if this game is live or final
                  const gameLiveStats = game.players
                    .map((p: any) => liveStats.find(stat => stat.playerId === p.playerId))
                    .filter(Boolean);
                  
                  // Use gameState from schedule API (always available) or fall back to liveStats
                  const gameState = game.gameState || gameLiveStats[0]?.gameState;
                  const isFinal = gameState === 'FINAL' || gameState === 'OFF';
                  const isLive = gameLiveStats.length > 0 || gameState === 'LIVE' || isFinal;
                  
                  return (
                  <div 
                    key={gameKey} 
                    className={`bg-gray-750 p-4 rounded-lg border-2 transition-all ${
                      isLive && !isFinal
                        ? 'border-red-500 shadow-lg shadow-red-500/20 animate-pulse'
                        : isFinal
                        ? 'border-green-500'
                        : 'border-gray-700 hover:border-blue-500'
                    }`}
                  >
                    {/* Game Header with Team Logos (LARGER) */}
                    <div className="flex items-center justify-between mb-3">
                      <img
                        src={`https://assets.nhle.com/logos/nhl/svg/${game.awayTeam}_dark.svg`}
                        alt={game.awayTeam}
                        className="w-12 h-12"
                      />
                      <div className="text-center">
                        {isLive ? (
                          <>
                            {/* LIVE: Show score and period */}
                            <div className="flex items-center justify-center gap-2 mb-1">
                              <span className={`inline-flex items-center gap-1 text-white px-2 py-0.5 rounded-full text-xs font-bold ${
                                isFinal 
                                  ? 'bg-green-600' 
                                  : 'bg-red-600 animate-pulse'
                              }`}>
                                <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                                {isFinal ? 'FINAL' : 'LIVE'}
                              </span>
                            </div>
                            <p className="text-white font-bold text-base">
                              {game.awayTeam} {gameLiveStats[0]?.awayScore || game.awayScore || 0} - {gameLiveStats[0]?.homeScore || game.homeScore || 0} {game.homeTeam}
                            </p>
                            {!isFinal && gameLiveStats[0]?.period > 0 && (
                              <p className="text-gray-400 text-xs mt-1">
                                P{gameLiveStats[0].period} {gameLiveStats[0].clock || ''}
                              </p>
                            )}
                          </>
                        ) : (
                          <>
                            {/* UPCOMING: Show game time */}
                            <p className="text-gray-400 text-xs">Game Time</p>
                            <p className="text-green-400 font-bold text-sm">{game.gameTime}</p>
                          </>
                        )}
                      </div>
                      <img
                        src={`https://assets.nhle.com/logos/nhl/svg/${game.homeTeam}_dark.svg`}
                        alt={game.homeTeam}
                        className="w-12 h-12"
                      />
                    </div>
                    
                    {/* Matchup Text (only show if not live) */}
                    {!isLive && (
                      <p className="text-center text-white font-semibold text-sm mb-3">
                        {game.awayTeam} <span className="text-gray-500">@</span> {game.homeTeam}
                      </p>
                    )}
                    
                    {/* Your Players */}
                    <div className="border-t border-gray-700 pt-3">
                      {/* Calculate scoring players count */}
                      {(() => {
                        const scoringPlayersCount = isFinal 
                          ? game.players.filter((p: any) => {
                              const stats = gameLiveStats.find((s: any) => s.playerId === p.playerId);
                              return stats && stats.points > 0;
                            }).length
                          : game.players.length;
                        
                        const hasNoScorers = isFinal && scoringPlayersCount === 0;
                        
                        return (
                          <>
                            {/* Only show "Your Players" header if there are scorers OR game isn't final */}
                            {!hasNoScorers && (
                              <p className="text-gray-400 text-xs mb-2">
                                Your Players ({scoringPlayersCount}):
                              </p>
                            )}
                            
                            {/* Show message if FINAL game with 0 scoring players */}
                            {hasNoScorers ? (
                              <div className="text-center py-4">
                                <p className="text-gray-500 text-sm">😔 No points scored by your players</p>
                              </div>
                            ) : isLive ? (
                        /* LIVE: Show stats table */
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-gray-800/50">
                              <tr>
                                <th className="text-left p-2 text-gray-400 font-medium">Player</th>
                                <th className="text-center p-2 text-gray-400 font-medium">G</th>
                                <th className="text-center p-2 text-gray-400 font-medium">A</th>
                                <th className="text-center p-2 text-gray-400 font-medium">H</th>
                                <th className="text-center p-2 text-gray-400 font-medium">BS</th>
                                <th className="text-center p-2 text-gray-400 font-medium">Pts</th>
                              </tr>
                            </thead>
                            <tbody>
                              {game.players
                                .filter((player: any) => {
                                  // For FINAL games, only show players with points
                                  if (isFinal) {
                                    const stats = gameLiveStats.find((s: any) => s.playerId === player.playerId);
                                    return stats && stats.points > 0;
                                  }
                                  return true; // Show all players for live games
                                })
                                .map((player: any) => {
                                const stats = gameLiveStats.find((s: any) => s.playerId === player.playerId);
                                return (
                                  <tr key={player.playerId} className="border-t border-gray-700">
                                    <td className="p-2">
                                      <div className="flex items-center gap-1.5">
                                        <img
                                          src={`https://assets.nhle.com/mugs/nhl/20242025/${player.teamAbbrev}/${player.playerId}.png`}
                                          alt={player.playerName}
                                          onError={(e) => {
                                            e.currentTarget.src = 'https://assets.nhle.com/mugs/nhl/default-skater.png';
                                          }}
                                          className="w-6 h-6 rounded-full"
                                        />
                                        <span className="text-white font-medium">{player.playerName}</span>
                                      </div>
                                    </td>
                                    <td className="p-2 text-center text-gray-300">{stats?.goals || 0}</td>
                                    <td className="p-2 text-center text-gray-300">{stats?.assists || 0}</td>
                                    <td className="p-2 text-center text-gray-300">{stats?.hits || 0}</td>
                                    <td className="p-2 text-center text-gray-300">{stats?.blockedShots || 0}</td>
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
                          {game.players.map((player: any) => (
                            <div
                              key={player.playerId}
                              className="flex items-center gap-1.5 bg-gray-800 px-2 py-1 rounded border border-gray-600"
                            >
                              <img
                                src={`https://assets.nhle.com/mugs/nhl/20242025/${player.teamAbbrev}/${player.playerId}.png`}
                                alt={player.playerName}
                                onError={(e) => {
                                  e.currentTarget.src = 'https://assets.nhle.com/mugs/nhl/default-skater.png';
                                }}
                                className="w-6 h-6 rounded-full"
                              />
                              <span className="text-white text-xs font-medium">{player.playerName}</span>
                            </div>
                          ))}
                        </div>
                      )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-gray-500">
                <p>No games for your active roster today.</p>
                <p className="text-sm mt-2">Check back tomorrow for upcoming matchups!</p>
              </div>
            )}
          </div>
        </div>
        </>
      )}

      {/* Info Box */}
      <div className="bg-blue-900/30 border-t border-blue-500/30 p-4">
        <p className="text-blue-200 text-sm">
          💡 <strong>Auto-Refresh:</strong> Stats update automatically every 5 minutes. 
          Click "🔄 Refresh Now" to update immediately. 
          Fantasy points will be calculated at end of day via daily scoring.
        </p>
      </div>
    </div>
  );
}
