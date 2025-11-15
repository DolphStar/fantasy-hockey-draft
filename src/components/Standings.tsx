import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { useLeague } from '../context/LeagueContext';
import type { TeamScore } from '../utils/scoringEngine';
import LiveStats from './LiveStats';
import { isPlayerInjuredByName, getInjuryIcon, getInjuryColor } from '../services/injuryService';
import { useInjuries } from '../queries/useInjuries';
// Import utilities for existing leagues
import '../utils/updateLeague';
import '../utils/clearScores';

interface PlayerPerformance {
  playerId: number;
  playerName: string;
  teamName: string;
  nhlTeam: string;
  date: string;
  points: number;
  stats: Record<string, number>;
}

export default function Standings() {
  const { league } = useLeague();
  const [standings, setStandings] = useState<TeamScore[]>([]);
  const [playerPerformances, setPlayerPerformances] = useState<PlayerPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(true);
  const [showScoringRules, setShowScoringRules] = useState(false);
  
  // React Query hook for injuries - automatic caching!
  const { data: injuries = [] } = useInjuries();

  // React Query automatically handles injury fetching and refetching!

  // Fetch standings
  useEffect(() => {
    if (!league) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        // Fetch team standings
        const standingsQuery = query(
          collection(db, `leagues/${league.id}/teamScores`),
          orderBy('totalPoints', 'desc')
        );
        
        const standingsSnapshot = await getDocs(standingsQuery);
        const teams = standingsSnapshot.docs.map(doc => doc.data() as TeamScore);
        setStandings(teams);

        // Fetch recent player performances (last 7 days)
        const performancesQuery = query(
          collection(db, `leagues/${league.id}/playerDailyScores`),
          orderBy('date', 'desc')
        );
        
        const performancesSnapshot = await getDocs(performancesQuery);
        const performances = performancesSnapshot.docs.map(doc => doc.data() as PlayerPerformance);
        
        // Sort by points descending for display
        performances.sort((a, b) => b.points - a.points);
        
        setPlayerPerformances(performances);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [league]);

  if (!league) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <h2 className="text-3xl font-bold mb-6 text-white">Standings</h2>
        <p className="text-gray-400">No league found. Create or join a league to see standings.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-3xl font-bold mb-6 text-white">{league.leagueName} - Standings</h2>

      {/* Collapsible Scoring Rules */}
      {league.scoringRules && (
        <div className="bg-gray-800/50 rounded-lg mb-6 border border-gray-700">
          <button
            onClick={() => setShowScoringRules(!showScoringRules)}
            className="w-full p-4 flex items-center justify-between hover:bg-gray-700/30 transition-colors rounded-lg"
          >
            <div className="flex items-center gap-2">
              <span className="text-2xl">📊</span>
              <h3 className="text-lg font-bold text-white">Scoring Rules</h3>
              <span className="text-gray-400 text-sm">How points are calculated</span>
            </div>
            <span className="text-gray-400 text-xl">{showScoringRules ? '▼' : '▶'}</span>
          </button>
          
          {showScoringRules && (
            <div className="p-4 pt-0 space-y-4">
              {/* Skaters */}
              <div>
                <h4 className="text-sm font-bold text-blue-400 mb-3 uppercase tracking-wide">⚡ Skaters</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700">
                    <div className="text-2xl mb-1">⚽</div>
                    <div className="text-xs text-gray-400 mb-1">Goal</div>
                    <div className="text-lg font-bold text-green-400">+{league.scoringRules.goal}</div>
                  </div>
                  <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700">
                    <div className="text-2xl mb-1">🎯</div>
                    <div className="text-xs text-gray-400 mb-1">Assist</div>
                    <div className="text-lg font-bold text-green-400">+{league.scoringRules.assist}</div>
                  </div>
                  <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700">
                    <div className="text-2xl mb-1">⭐</div>
                    <div className="text-xs text-gray-400 mb-1">SH Goal</div>
                    <div className="text-lg font-bold text-yellow-400">+{league.scoringRules.shortHandedGoal}</div>
                  </div>
                  <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700">
                    <div className="text-2xl mb-1">⏰</div>
                    <div className="text-xs text-gray-400 mb-1">OT Goal</div>
                    <div className="text-lg font-bold text-yellow-400">+{league.scoringRules.overtimeGoal}</div>
                  </div>
                  <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700">
                    <div className="text-2xl mb-1">🥊</div>
                    <div className="text-xs text-gray-400 mb-1">Fight</div>
                    <div className="text-lg font-bold text-red-400">+{league.scoringRules.fight}</div>
                  </div>
                </div>
              </div>
              
              {/* Defense */}
              <div>
                <h4 className="text-sm font-bold text-green-400 mb-3 uppercase tracking-wide">🛡️ Defense</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700">
                    <div className="text-2xl mb-1">🛡️</div>
                    <div className="text-xs text-gray-400 mb-1">Blocked Shot</div>
                    <div className="text-lg font-bold text-green-400">+{league.scoringRules.blockedShot}</div>
                  </div>
                  <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700">
                    <div className="text-2xl mb-1">💥</div>
                    <div className="text-xs text-gray-400 mb-1">Hit</div>
                    <div className="text-lg font-bold text-green-400">+{league.scoringRules.hit}</div>
                  </div>
                </div>
              </div>
              
              {/* Goalies */}
              <div>
                <h4 className="text-sm font-bold text-purple-400 mb-3 uppercase tracking-wide">🥅 Goalies</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700">
                    <div className="text-2xl mb-1">🏆</div>
                    <div className="text-xs text-gray-400 mb-1">Win</div>
                    <div className="text-lg font-bold text-green-400">+{league.scoringRules.win}</div>
                  </div>
                  <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700">
                    <div className="text-2xl mb-1">🚫</div>
                    <div className="text-xs text-gray-400 mb-1">Shutout</div>
                    <div className="text-lg font-bold text-yellow-400">+{league.scoringRules.shutout}</div>
                  </div>
                  <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700">
                    <div className="text-2xl mb-1">🥅</div>
                    <div className="text-xs text-gray-400 mb-1">Save</div>
                    <div className="text-lg font-bold text-green-400">+{league.scoringRules.save}</div>
                  </div>
                  <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700">
                    <div className="text-2xl mb-1">🎯</div>
                    <div className="text-xs text-gray-400 mb-1">G Assist</div>
                    <div className="text-lg font-bold text-green-400">+{league.scoringRules.goalieAssist}</div>
                  </div>
                  <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700">
                    <div className="text-2xl mb-1">⚽</div>
                    <div className="text-xs text-gray-400 mb-1">G Goal</div>
                    <div className="text-lg font-bold text-yellow-400">+{league.scoringRules.goalieGoal}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Standings Table */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl shadow-2xl overflow-hidden border border-gray-700">
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-6">
          <h3 className="text-2xl font-bold text-white flex items-center gap-2">
            🏆 Current Standings
          </h3>
          <p className="text-blue-100 text-sm mt-1">League rankings based on total fantasy points</p>
        </div>
        
        {loading ? (
          <p className="p-6 text-gray-400">Loading standings...</p>
        ) : standings.length === 0 ? (
          <div className="p-6">
            <p className="text-gray-400 mb-2">No scores yet. Scores are calculated daily based on player performances.</p>
            <p className="text-gray-500 text-sm">Check back after games have been played and scored!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="text-left p-4 text-gray-300 font-semibold">Rank</th>
                  <th className="text-left p-4 text-gray-300 font-semibold">Team</th>
                  <th className="text-center p-4 text-gray-300 font-semibold">Points</th>
                  <th className="text-center p-4 text-gray-300 font-semibold text-xs">Proj. Season</th>
                  <th className="text-center p-4 text-gray-300 font-semibold">W</th>
                  <th className="text-center p-4 text-gray-300 font-semibold">L</th>
                  <th className="text-left p-4 text-gray-300 font-semibold">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((team, index) => {
                  const isFirst = index === 0;
                  const isLast = index === standings.length - 1;
                  
                  // Calculate projected season points (assuming 82-game season)
                  // Rough estimate: current points per day * days in season
                  const daysElapsed = team.lastUpdated 
                    ? Math.max(1, Math.floor((new Date().getTime() - new Date(team.lastUpdated).getTime()) / (1000 * 60 * 60 * 24)))
                    : 1;
                  const pointsPerDay = team.totalPoints / Math.max(1, daysElapsed);
                  const projectedPoints = Math.round(pointsPerDay * 180); // ~6 months season
                  
                  return (
                    <tr
                      key={team.teamName}
                      className={`border-t border-gray-700 hover:bg-gray-750 transition-colors ${
                        isFirst ? 'bg-yellow-900/20' : ''
                      } ${isLast ? 'bg-red-900/10' : ''}`}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                              isFirst
                                ? 'bg-yellow-500 text-black'
                                : isLast
                                ? 'bg-red-900 text-white'
                                : 'bg-gray-700 text-white'
                            }`}
                          >
                            {index + 1}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-white font-semibold">{team.teamName}</span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-2xl font-bold text-green-400">
                            {team.totalPoints.toFixed(2)}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-gray-400 text-sm">
                          ~{projectedPoints}
                        </span>
                      </td>
                      <td className="p-4 text-center text-gray-300">{team.wins || 0}</td>
                      <td className="p-4 text-center text-gray-300">{team.losses || 0}</td>
                      <td className="p-4 text-gray-400 text-sm">
                        {team.lastUpdated
                          ? new Date(team.lastUpdated).toLocaleDateString()
                          : 'N/A'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Live Stats Section */}
      <LiveStats />

      {/* Player Performance Details - Grouped by Team */}
      {playerPerformances.length > 0 && (
        <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden mt-6">
          <div className="flex items-center justify-between p-6 pb-4">
            <h3 className="text-xl font-semibold text-white">🏒 Player Performances</h3>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm transition-colors"
            >
              {showDetails ? 'Hide Details' : 'Show Details'}
            </button>
          </div>
          
          {showDetails && (
            <div className="p-6 pt-0 space-y-6">
              {/* Group performances by team */}
              {standings.map((team) => {
                const teamPerfs = playerPerformances.filter(p => p.teamName === team.teamName);
                if (teamPerfs.length === 0) return null;
                
                return (
                  <div key={team.teamName} className="bg-gray-750 rounded-lg overflow-hidden">
                    {/* Team Header */}
                    <div className="bg-gray-700 px-4 py-3">
                      <h4 className="text-lg font-bold text-white">{team.teamName}</h4>
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
                            <th className="text-center p-3 text-gray-400 font-medium text-sm">🚫 SO</th>
                            <th className="text-center p-3 text-gray-400 font-medium text-sm font-bold">Points</th>
                          </tr>
                        </thead>
                        <tbody>
                          {teamPerfs.map((perf, index) => {
                            // Check if this is a "big night" (goal or 2+ points)
                            const isBigNight = (perf.stats.goals && perf.stats.goals > 0) || perf.points >= 2;
                            
                            return (
                            <tr
                              key={`${perf.playerId}-${perf.date}-${index}`}
                              className={`border-t border-gray-700 hover:bg-gray-700/30 transition-colors ${
                                isBigNight ? 'bg-green-900/10' : ''
                              }`}
                            >
                              <td className="p-3">
                                <div>
                                  <div className="text-white font-medium flex items-center gap-2">
                                    {perf.playerName}
                                    {(() => {
                                      const injury = isPlayerInjuredByName(perf.playerName, injuries);
                                      return injury && (
                                        <span className={`${getInjuryColor(injury.status)} text-white text-xs px-1.5 py-0.5 rounded text-[10px] font-bold`} title={`${injury.injuryType} - ${injury.description}`}>
                                          {getInjuryIcon(injury.status)}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                  <div className="text-gray-500 text-xs">
                                    {new Date(perf.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </div>
                                </div>
                              </td>
                              <td className="p-3 text-center">
                                <div className="flex items-center justify-center">
                                  <img
                                    src={`https://assets.nhle.com/logos/nhl/svg/${perf.nhlTeam}_dark.svg`}
                                    alt={perf.nhlTeam}
                                    className="w-6 h-6"
                                    onError={(e) => {
                                      // Fallback to text if logo fails to load
                                      const target = e.currentTarget as HTMLImageElement;
                                      target.style.display = 'none';
                                      const sibling = target.nextElementSibling as HTMLSpanElement;
                                      if (sibling) sibling.style.display = 'inline';
                                    }}
                                  />
                                  <span className="text-gray-400 text-xs font-mono hidden">{perf.nhlTeam}</span>
                                </div>
                              </td>
                              <td className={`p-3 text-center ${
                                isBigNight ? 'text-white font-semibold' : 'text-gray-300'
                              }`}>{perf.stats.goals || 0}</td>
                              <td className={`p-3 text-center ${
                                isBigNight ? 'text-white font-semibold' : 'text-gray-300'
                              }`}>{perf.stats.assists || 0}</td>
                              <td className={`p-3 text-center ${
                                isBigNight ? 'text-white font-semibold' : 'text-gray-300'
                              }`}>{perf.stats.hits || 0}</td>
                              <td className={`p-3 text-center ${
                                isBigNight ? 'text-white font-semibold' : 'text-gray-300'
                              }`}>{perf.stats.blockedShots || 0}</td>
                              <td className={`p-3 text-center ${
                                isBigNight ? 'text-white font-semibold' : 'text-gray-300'
                              }`}>{perf.stats.wins || 0}</td>
                              <td className={`p-3 text-center ${
                                isBigNight ? 'text-white font-semibold' : 'text-gray-300'
                              }`}>{perf.stats.saves || 0}</td>
                              <td className={`p-3 text-center ${
                                isBigNight ? 'text-white font-semibold' : 'text-gray-300'
                              }`}>{perf.stats.shutouts || 0}</td>
                              <td className="p-3 text-center">
                                <span className={`text-base font-bold ${
                                  perf.points > 0 ? 'text-green-400' : perf.points < 0 ? 'text-red-400' : 'text-gray-400'
                                }`}>
                                  {perf.points > 0 ? '+' : ''}{perf.points.toFixed(2)}
                                </span>
                              </td>
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
        </div>
      )}

    </div>
  );
}
