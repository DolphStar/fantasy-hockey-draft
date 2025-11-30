import { useState, useEffect } from 'react';
import { db } from '../firebase';

import { collection, onSnapshot, getDocs, query, where } from 'firebase/firestore';
import { useLeague } from '../context/LeagueContext';
import { useDraft } from '../context/DraftContext';
import { processLiveStats } from '../utils/liveStats';
import type { LivePlayerStats } from '../utils/liveStats';
import { fetchTodaySchedule, getUpcomingMatchups, type PlayerMatchup } from '../utils/nhlSchedule';
import { GlassCard } from './ui/GlassCard';
import { Badge } from './ui/Badge';

interface LiveStatsProps {
  showAllTeams?: boolean; // If true, show all teams' stats (for Standings page)
}

export default function LiveStats({ showAllTeams = false }: LiveStatsProps = {}) {
  const { league, myTeam } = useLeague();
  const { draftState } = useDraft();
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

    // Get active roster player IDs to filter live stats
    const getActivePlayerIds = async () => {
      if (!myTeam && !showAllTeams) return new Set<number>();

      // If showAllTeams, get ALL active players from ALL teams
      // Otherwise, just get the current user's active roster
      const constraints: any[] = [
        where('leagueId', '==', league.id)
      ];

      if (!showAllTeams && myTeam) {
        constraints.push(where('draftedByTeam', '==', myTeam.teamName));
      }

      const draftedSnapshot = await getDocs(
        query(collection(db, 'draftedPlayers'), ...constraints)
      );
      
      // Filter for active players (rosterSlot === 'active' or undefined/missing)
      // Players without rosterSlot field are treated as active (legacy data)
      return new Set(
        draftedSnapshot.docs
          .filter((doc: any) => {
            const slot = doc.data().rosterSlot;
            return !slot || slot === 'active';
          })
          .map((doc: any) => doc.data().playerId)
      );
    };

    // Set up real-time listener
    const setupListener = async () => {
      const activePlayerIds = await getActivePlayerIds();
      console.log(`📊 LiveStats: Tracking ${activePlayerIds.size} active players for date ${today}`);

      const unsubscribe = onSnapshot(liveStatsRef, (snapshot) => {
        const stats: LivePlayerStats[] = [];
        let totalDocs = 0;
        let todayDocs = 0;

        snapshot.forEach(doc => {
          totalDocs++;
          // Only include today's stats for ACTIVE roster players
          if (doc.id.startsWith(today)) {
            todayDocs++;
            const stat = doc.data() as LivePlayerStats;
            if (activePlayerIds.has(stat.playerId)) {
              stats.push(stat);
            }
          }
        });

        console.log(`📊 LiveStats: Found ${totalDocs} total docs, ${todayDocs} for today, ${stats.length} matching active players`);

        // Sort by points descending
        stats.sort((a, b) => b.points - a.points);

        setLiveStats(stats);
        setLastUpdate(new Date());
        setLoading(false);
      });

      return unsubscribe;
    };

    let unsubscribe: (() => void) | null = null;
    setupListener().then(unsub => { unsubscribe = unsub; });

    return () => { if (unsubscribe) unsubscribe(); };
  }, [league]);

  // Fetch upcoming matchups (always, not just when no live stats)
  useEffect(() => {
    if (!league) return;
    // For showAllTeams (Standings page), we don't need myTeam
    if (!showAllTeams && !myTeam) return;

    const fetchMatchups = async () => {
      try {
        // Fetch today's schedule
        const todaysGames = await fetchTodaySchedule();

        // Get roster from drafted players
        const draftedPlayersSnapshot = await onSnapshot(
          collection(db, 'draftedPlayers'),
          (snapshot) => {
            const roster = snapshot.docs
              .filter(doc => {
                const data = doc.data();
                const slot = data.rosterSlot;
                const isActive = !slot || slot === 'active'; // Include players without rosterSlot field
                
                if (showAllTeams) {
                  // Standings page: show ALL teams' active players
                  return data.leagueId === league.id && isActive;
                } else {
                  // Dashboard: show only your team's active players
                  return data.leagueId === league.id && isActive && data.draftedByTeam === myTeam?.teamName;
                }
              })
              .map(doc => {
                const data = doc.data();
                return {
                  playerId: data.playerId,
                  name: data.name,
                  nhlTeam: data.nhlTeam
                };
              });

            console.log(`📊 Matchups: Found ${roster.length} active players for matchups`);

            // Get matchups for roster
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
  }, [league, myTeam, showAllTeams]);

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

  // Initial fetch + Auto-refresh live stats every 5 minutes
  useEffect(() => {
    if (!league) return;

    // Fetch immediately on mount to populate data
    const initialFetch = async () => {
      console.log('🔄 Initial live stats fetch...');
      try {
        await processLiveStats(league.id);
      } catch (error) {
        console.error('Initial fetch failed:', error);
      }
    };
    initialFetch();

    // Then auto-refresh every 5 minutes
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

  // Only show live stats when the league is active (draft complete)
  // Don't show during draft ('pending') or after season ends ('complete')
  if (league.status !== 'live' || !draftState?.isComplete) {
    return null;
  }

  return (
    <GlassCard className="overflow-hidden mt-6">
      <div className="p-6 pb-4 border-b border-slate-700/50 bg-slate-900/30">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <div className="absolute inset-0 w-3 h-3 bg-red-500 rounded-full animate-ping opacity-75"></div>
            </div>
            <h3 className="text-xl font-bold text-white">Live Stats - Today's Games</h3>
            {liveStats.length > 0 && (
              <Badge variant="danger" className="animate-pulse">LIVE</Badge>
            )}
            {refreshing && (
              <span className="animate-spin text-blue-400 text-lg">🔄</span>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Countdown Timer */}
            <div className="text-center">
              <p className="text-slate-400 text-xs">Next refresh in</p>
              <p className="text-green-400 text-sm font-mono font-bold">{formatCountdown(secondsUntilRefresh)}</p>
            </div>

            {/* Manual Refresh Button */}
            <button
              onClick={handleManualRefresh}
              disabled={refreshing}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors border ${refreshing
                ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500 hover:border-blue-400 shadow-lg shadow-blue-900/20'
                }`}
            >
              {refreshing ? 'Refreshing...' : '🔄 Refresh Now'}
            </button>

            {/* Last Updated */}
            {lastUpdate && (
              <div className="text-right hidden sm:block">
                <p className="text-slate-400 text-xs">Last updated</p>
                <p className="text-slate-300 text-sm font-mono">{lastUpdate.toLocaleTimeString()}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center">
          <div className="animate-spin text-3xl mb-4 text-slate-500">🔄</div>
          <p className="text-slate-400">Loading live stats...</p>
        </div>
      ) : (
        <>
          {/* Live Stats Section - Only show players with points > 0 */}
          {liveStats.length > 0 && (
            <div className="p-6 space-y-6">
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
                  <div key={teamName} className="space-y-3">
                    {/* Team Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-700/50">
                      <Badge variant="outline" className="text-base px-3 py-1">
                        {teamName}
                      </Badge>
                      <div className="text-right flex items-center gap-2">
                        <span className="text-slate-400 text-xs uppercase tracking-wider">Today's Totals</span>
                        <span className="text-green-400 font-bold text-xl drop-shadow-sm">
                          {teamTotals.points.toFixed(2)} Pts
                        </span>
                      </div>
                    </div>

                    {/* Player Stats Table */}
                    <div className="overflow-x-auto bg-slate-900/20 rounded-lg border border-slate-700/30">
                      <table className="w-full">
                        <thead className="bg-slate-800/50 text-xs uppercase">
                          <tr>
                            <th className="text-left p-3 text-slate-400 font-medium">Player</th>
                            <th className="text-center p-3 text-slate-400 font-medium">NHL</th>
                            <th className="text-center p-3 text-slate-400 font-medium">G</th>
                            <th className="text-center p-3 text-slate-400 font-medium">A</th>
                            <th className="text-center p-3 text-slate-400 font-medium">H</th>
                            <th className="text-center p-3 text-slate-400 font-medium">BS</th>
                            <th className="text-center p-3 text-slate-400 font-medium">F</th>
                            <th className="text-center p-3 text-slate-400 font-medium">W</th>
                            <th className="text-center p-3 text-slate-400 font-medium">Sv</th>
                            <th className="text-center p-3 text-slate-400 font-bold">Pts</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/30">
                          {playersWithPoints.map((player, index) => (
                            <tr
                              key={`${player.playerId}-${index}`}
                              className="hover:bg-slate-800/30 transition-colors"
                            >
                              <td className="p-3">
                                <span className="text-white font-medium">{player.playerName}</span>
                              </td>
                              <td className="p-3 text-center text-slate-400 text-sm">{player.nhlTeam}</td>
                              <td className="p-3 text-center text-slate-300 font-medium">{player.goals}</td>
                              <td className="p-3 text-center text-slate-300 font-medium">{player.assists}</td>
                              <td className="p-3 text-center text-slate-400">{player.hits || 0}</td>
                              <td className="p-3 text-center text-slate-400">{player.blockedShots || 0}</td>
                              <td className="p-3 text-center text-slate-400">{player.fights || 0}</td>
                              <td className="p-3 text-center text-slate-400">{player.wins || 0}</td>
                              <td className="p-3 text-center text-slate-400">{player.saves || 0}</td>
                              <td className="p-3 text-center">
                                <Badge variant="success">+{player.points.toFixed(2)}</Badge>
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
          <div className={`p-6 ${liveStats.length > 0 ? 'border-t border-slate-700/50' : ''}`}>
            <div className="text-center py-4 mb-4">
              <h4 className="text-xl font-bold text-white mb-2 flex items-center justify-center gap-2">
                <span>🏒</span> Today's Matchups
              </h4>
              <p className="text-slate-400 text-sm">
                Your players' games for today
              </p>
            </div>

            {upcomingMatchups.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto">
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
                      <GlassCard
                        key={gameKey}
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
                                    {game.players.map((player: any) => (
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
                              </>
                            );
                          })()}
                        </div>
                      </GlassCard>
                    );
                  })}
              </div>
            ) : (
              <div className="text-slate-500 text-center py-8 bg-slate-900/20 rounded-lg border border-slate-800 border-dashed">
                <p className="text-lg">No games for your active roster today.</p>
                <p className="text-sm mt-2">Check back tomorrow for upcoming matchups!</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Info Box */}
      <div className="bg-blue-900/20 border-t border-blue-500/20 p-4 flex items-start gap-3">
        <div className="text-xl">💡</div>
        <p className="text-blue-200 text-sm leading-relaxed">
          <strong>Auto-Refresh:</strong> Stats update automatically every 5 minutes.
          Click "🔄 Refresh Now" to update immediately.
          Fantasy points will be calculated at end of day via daily scoring.
        </p>
      </div>
    </GlassCard>
  );
}
