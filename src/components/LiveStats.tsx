import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { useLeague } from '../context/LeagueContext';
import type { LivePlayerStats } from '../utils/liveStats';

export default function LiveStats() {
  const { league } = useLeague();
  const [liveStats, setLiveStats] = useState<LivePlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Real-time listener for live stats
  useEffect(() => {
    if (!league) {
      setLoading(false);
      return;
    }

    const today = new Date().toISOString().split('T')[0];
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-semibold text-white">🔴 Live Stats - Today's Games</h3>
            {liveStats.length > 0 && (
              <span className="animate-pulse bg-red-600 text-white text-xs px-2 py-1 rounded-full">
                LIVE
              </span>
            )}
          </div>
          {lastUpdate && (
            <div className="text-right">
              <p className="text-gray-400 text-xs">Last updated</p>
              <p className="text-gray-300 text-sm">{lastUpdate.toLocaleTimeString()}</p>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="p-6">
          <p className="text-gray-400">Loading live stats...</p>
        </div>
      ) : liveStats.length === 0 ? (
        <div className="p-6">
          <p className="text-gray-400">No games in progress or completed today yet.</p>
          <p className="text-gray-500 text-sm mt-1">
            Live stats will appear here once today's NHL games start. Updates every 10-15 minutes during games.
          </p>
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
          🔴 <strong>Live Updates:</strong> Stats update automatically every 10-15 minutes during games. 
          Fantasy points will be calculated at end of day. Refresh the page to see the latest updates.
        </p>
      </div>
    </div>
  );
}
