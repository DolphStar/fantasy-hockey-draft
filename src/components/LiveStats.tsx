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

    // Get today's date in local timezone
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
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

  // Fetch upcoming matchups when no live stats
  useEffect(() => {
    if (!league || !myTeam || liveStats.length > 0) return;

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
  }, [league, myTeam, liveStats.length]);

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
      ) : liveStats.length === 0 ? (
        <div className="p-6">
          <div className="text-center py-4">
            <h4 className="text-lg font-bold text-white mb-2">🏒 Upcoming Matchups Tonight</h4>
            <p className="text-gray-400 text-sm mb-6">
              Your players' games for today
            </p>
            
            {upcomingMatchups.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-4xl mx-auto">
                {/* Group matchups by game */}
                {Object.entries(
                  upcomingMatchups.reduce((acc, matchup) => {
                    const gameKey = `${matchup.teamAbbrev}-${matchup.opponent}-${matchup.gameTime}`;
                    if (!acc[gameKey]) {
                      acc[gameKey] = {
                        teamAbbrev: matchup.teamAbbrev,
                        opponent: matchup.opponent,
                        gameTime: matchup.gameTime,
                        isHome: matchup.isHome,
                        players: []
                      };
                    }
                    acc[gameKey].players.push(matchup);
                    return acc;
                  }, {} as Record<string, any>)
                ).map(([gameKey, game]) => (
                  <div 
                    key={gameKey} 
                    className="bg-gray-750 p-4 rounded-lg border border-gray-700 hover:border-blue-500 transition-colors"
                  >
                    {/* Game Header with Team Logos */}
                    <div className="flex items-center justify-between mb-3">
                      <img
                        src={`https://assets.nhle.com/logos/nhl/svg/${game.isHome ? game.opponent : game.teamAbbrev}_dark.svg`}
                        alt={game.isHome ? game.opponent : game.teamAbbrev}
                        className="w-10 h-10"
                      />
                      <div className="text-center">
                        <p className="text-gray-400 text-xs">Game Time</p>
                        <p className="text-green-400 font-bold text-sm">{game.gameTime}</p>
                      </div>
                      <img
                        src={`https://assets.nhle.com/logos/nhl/svg/${game.isHome ? game.teamAbbrev : game.opponent}_dark.svg`}
                        alt={game.isHome ? game.teamAbbrev : game.opponent}
                        className="w-10 h-10"
                      />
                    </div>
                    
                    {/* Matchup Text */}
                    <p className="text-center text-white font-semibold text-sm mb-3">
                      {game.isHome ? game.opponent : game.teamAbbrev} <span className="text-gray-500">@</span> {game.isHome ? game.teamAbbrev : game.opponent}
                    </p>
                    
                    {/* Your Players */}
                    <div className="border-t border-gray-700 pt-3">
                      <p className="text-gray-400 text-xs mb-2">Your Players ({game.players.length}):</p>
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
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-500">
                <p>No games for your active roster today.</p>
                <p className="text-sm mt-2">Check back tomorrow for upcoming matchups!</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-6 pt-0 space-y-6">
          {Object.entries(statsByTeam).map(([teamName, players]) => {
            const teamTotals = players.reduce(
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
                    <p className="text-green-400 font-bold">
                      {teamTotals.goals}G + {teamTotals.assists}A = {teamTotals.points} Pts
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
                        <th className="text-center p-3 text-gray-400 font-medium text-sm">Status</th>
                        <th className="text-center p-3 text-gray-400 font-medium text-sm">⚽ G</th>
                        <th className="text-center p-3 text-gray-400 font-medium text-sm">🎯 A</th>
                        <th className="text-center p-3 text-gray-400 font-medium text-sm">📊 Pts</th>
                        <th className="text-center p-3 text-gray-400 font-medium text-sm">🏹 S</th>
                        <th className="text-center p-3 text-gray-400 font-medium text-sm">💥 H</th>
                        <th className="text-center p-3 text-gray-400 font-medium text-sm">🛡️ BS</th>
                        <th className="text-center p-3 text-gray-400 font-medium text-sm">🏆 W</th>
                        <th className="text-center p-3 text-gray-400 font-medium text-sm">🥅 Sv</th>
                      </tr>
                    </thead>
                    <tbody>
                      {players.map((player, index) => {
                        const isLive = player.gameState === 'LIVE' || player.gameState === 'CRIT';
                        const isFinal = player.gameState === 'FINAL' || player.gameState === 'OFF';

                        return (
                          <tr
                            key={`${player.playerId}-${index}`}
                            className={`border-t border-gray-700 transition-colors ${
                              isLive ? 'bg-red-900/10 hover:bg-red-900/20' : 'hover:bg-gray-700/30'
                            }`}
                          >
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <span className="text-white font-medium">{player.playerName}</span>
                                {isLive && (
                                  <span className="animate-pulse bg-red-600 text-white text-xs px-1.5 py-0.5 rounded">
                                    LIVE
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              <span className="text-gray-400 text-sm font-mono">{player.nhlTeam}</span>
                            </td>
                            <td className="p-3 text-center">
                              <span
                                className={`text-xs px-2 py-1 rounded ${
                                  isLive
                                    ? 'bg-red-600 text-white'
                                    : isFinal
                                    ? 'bg-green-600 text-white'
                                    : 'bg-gray-600 text-gray-300'
                                }`}
                              >
                                {isLive ? 'LIVE' : isFinal ? 'FINAL' : player.gameState}
                              </span>
                            </td>
                            <td className="p-3 text-center text-gray-300 font-medium">{player.goals}</td>
                            <td className="p-3 text-center text-gray-300 font-medium">{player.assists}</td>
                            <td className="p-3 text-center">
                              <span className="text-green-400 font-bold">{player.points}</span>
                            </td>
                            <td className="p-3 text-center text-gray-300">{player.shots}</td>
                            <td className="p-3 text-center text-gray-300">{player.hits}</td>
                            <td className="p-3 text-center text-gray-300">{player.blockedShots}</td>
                            <td className="p-3 text-center text-gray-300">{player.wins}</td>
                            <td className="p-3 text-center text-gray-300">{player.saves}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-900/30 border-t border-blue-500/30 p-4">
        <p className="text-blue-200 text-sm">
          � <strong>Auto-Refresh:</strong> Stats update automatically every 5 minutes. 
          Click "🔄 Refresh Now" to update immediately. 
          Fantasy points will be calculated at end of day via daily scoring.
        </p>
      </div>
    </div>
  );
}
