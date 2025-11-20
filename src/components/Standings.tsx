import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { useLeague } from '../context/LeagueContext';
import type { TeamScore } from '../utils/scoringEngine';
import LiveStats from './LiveStats';
import { isPlayerInjuredByName, getInjuryIcon, getInjuryColor } from '../services/injuryService';
import { useInjuries } from '../queries/useInjuries';
import { GlassCard } from './ui/GlassCard';
import { Badge } from './ui/Badge';
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
        <p className="text-slate-400">No league found. Create or join a league to see standings.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-white">{league.leagueName} - Standings</h2>
      </div>

      {/* Collapsible Scoring Rules */}
      {league.scoringRules && (
        <GlassCard className="p-0 overflow-hidden">
          <button
            onClick={() => setShowScoringRules(!showScoringRules)}
            className="w-full p-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-xl">
                📊
              </div>
              <div className="text-left">
                <h3 className="text-lg font-bold text-white">Scoring Rules</h3>
                <p className="text-slate-400 text-sm">How points are calculated</p>
              </div>
            </div>
            <span className={`text-slate-400 transition-transform duration-300 ${showScoringRules ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>

          {showScoringRules && (
            <div className="p-6 pt-2 border-t border-slate-700/50 bg-slate-900/30">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Skaters */}
                <div>
                  <h4 className="text-sm font-bold text-blue-400 mb-3 uppercase tracking-wide flex items-center gap-2">
                    <span>⚡</span> Skaters
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center bg-slate-800/50 p-2 rounded border border-slate-700/50">
                      <span className="text-slate-300 text-sm">Goal</span>
                      <span className="font-bold text-green-400">+{league.scoringRules.goal}</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-800/50 p-2 rounded border border-slate-700/50">
                      <span className="text-slate-300 text-sm">Assist</span>
                      <span className="font-bold text-green-400">+{league.scoringRules.assist}</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-800/50 p-2 rounded border border-slate-700/50">
                      <span className="text-slate-300 text-sm">SH Goal</span>
                      <span className="font-bold text-yellow-400">+{league.scoringRules.shortHandedGoal}</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-800/50 p-2 rounded border border-slate-700/50">
                      <span className="text-slate-300 text-sm">OT Goal</span>
                      <span className="font-bold text-yellow-400">+{league.scoringRules.overtimeGoal}</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-800/50 p-2 rounded border border-slate-700/50">
                      <span className="text-slate-300 text-sm">Fight</span>
                      <span className="font-bold text-red-400">+{league.scoringRules.fight}</span>
                    </div>
                  </div>
                </div>

                {/* Defense */}
                <div>
                  <h4 className="text-sm font-bold text-green-400 mb-3 uppercase tracking-wide flex items-center gap-2">
                    <span>🛡️</span> Defense
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center bg-slate-800/50 p-2 rounded border border-slate-700/50">
                      <span className="text-slate-300 text-sm">Blocked Shot</span>
                      <span className="font-bold text-green-400">+{league.scoringRules.blockedShot}</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-800/50 p-2 rounded border border-slate-700/50">
                      <span className="text-slate-300 text-sm">Hit</span>
                      <span className="font-bold text-green-400">+{league.scoringRules.hit}</span>
                    </div>
                  </div>
                </div>

                {/* Goalies */}
                <div>
                  <h4 className="text-sm font-bold text-purple-400 mb-3 uppercase tracking-wide flex items-center gap-2">
                    <span>🥅</span> Goalies
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center bg-slate-800/50 p-2 rounded border border-slate-700/50">
                      <span className="text-slate-300 text-sm">Win</span>
                      <span className="font-bold text-green-400">+{league.scoringRules.win}</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-800/50 p-2 rounded border border-slate-700/50">
                      <span className="text-slate-300 text-sm">Shutout</span>
                      <span className="font-bold text-yellow-400">+{league.scoringRules.shutout}</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-800/50 p-2 rounded border border-slate-700/50">
                      <span className="text-slate-300 text-sm">Save</span>
                      <span className="font-bold text-green-400">+{league.scoringRules.save}</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-800/50 p-2 rounded border border-slate-700/50">
                      <span className="text-slate-300 text-sm">Goalie Goal</span>
                      <span className="font-bold text-yellow-400">+{league.scoringRules.goalieGoal}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </GlassCard>
      )}

      {/* Standings Table */}
      <GlassCard className="overflow-hidden">
        <div className="p-6 border-b border-slate-700/50 bg-slate-900/30 flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold text-white flex items-center gap-2">
              🏆 Current Standings
            </h3>
            <p className="text-slate-400 text-sm mt-1">League rankings based on total fantasy points</p>
          </div>
          <div className="text-right text-xs text-slate-500">
            Updated daily
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin text-4xl mb-4">🔄</div>
            <p className="text-slate-400">Loading standings...</p>
          </div>
        ) : standings.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-slate-400 mb-2">No scores yet. Scores are calculated daily based on player performances.</p>
            <p className="text-slate-500 text-sm">Check back after games have been played and scored!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900/50 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left p-4 text-slate-400 font-semibold">Rank</th>
                  <th className="text-left p-4 text-slate-400 font-semibold">Team</th>
                  <th className="text-center p-4 text-slate-400 font-semibold">Points</th>
                  <th className="text-center p-4 text-slate-400 font-semibold">W</th>
                  <th className="text-center p-4 text-slate-400 font-semibold">L</th>
                  <th className="text-right p-4 text-slate-400 font-semibold">Last Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {standings.map((team, index) => {
                  const isFirst = index === 0;
                  const isSecond = index === 1;
                  const isThird = index === 2;

                  return (
                    <tr
                      key={team.teamName}
                      className="hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="p-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${isFirst ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' :
                          isSecond ? 'bg-slate-300 text-black shadow-lg shadow-slate-300/20' :
                            isThird ? 'bg-amber-700 text-white shadow-lg shadow-amber-700/20' :
                              'bg-slate-800 text-slate-400'
                          }`}>
                          {index + 1}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold ${isFirst ? 'bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 text-yellow-500 border border-yellow-500/30' :
                            'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}>
                            {team.teamName.substring(0, 2).toUpperCase()}
                          </div>
                          <span className={`font-bold text-lg ${isFirst ? 'text-yellow-400' : 'text-white'}`}>
                            {team.teamName}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-2xl font-black text-green-400 drop-shadow-sm">
                          {team.totalPoints.toFixed(2)}
                        </span>
                      </td>
                      <td className="p-4 text-center text-slate-300 font-medium">{team.wins || 0}</td>
                      <td className="p-4 text-center text-slate-300 font-medium">{team.losses || 0}</td>
                      <td className="p-4 text-right text-slate-500 text-sm font-mono">
                        {team.lastUpdated
                          ? new Date(team.lastUpdated).toLocaleDateString()
                          : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* Live Stats Section - Show all teams' stats on Standings page */}
      <LiveStats showAllTeams={true} />

      {/* Player Performance Details - Grouped by Team */}
      {playerPerformances.length > 0 && (
        <GlassCard className="overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b border-slate-700/50 bg-slate-900/30">
            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <span>🏒</span> Player Performances
              </h3>
              <p className="text-slate-400 text-sm mt-1">Recent games and fantasy points</p>
            </div>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-slate-300 hover:text-white text-sm transition-colors font-medium"
            >
              {showDetails ? 'Hide Details' : 'Show Details'}
            </button>
          </div>

          {showDetails && (
            <div className="p-6 space-y-8">
              {/* Group performances by team */}
              {standings.map((team) => {
                const teamPerfs = playerPerformances.filter(p => p.teamName === team.teamName);
                if (teamPerfs.length === 0) return null;

                return (
                  <div key={team.teamName} className="space-y-3">
                    {/* Team Header */}
                    <div className="flex items-center gap-3 pb-2 border-b border-slate-700/50">
                      <Badge variant="outline" className="text-base px-3 py-1">
                        {team.teamName}
                      </Badge>
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
                            <th className="text-center p-3 text-slate-400 font-medium">W</th>
                            <th className="text-center p-3 text-slate-400 font-medium">Sv</th>
                            <th className="text-center p-3 text-slate-400 font-medium">SO</th>
                            <th className="text-center p-3 text-slate-400 font-bold">Points</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/30">
                          {teamPerfs.map((perf, index) => {
                            // Check if this is a "big night" (goal or 2+ points)
                            const isBigNight = (perf.stats.goals && perf.stats.goals > 0) || perf.points >= 2;

                            return (
                              <tr
                                key={`${perf.playerId}-${perf.date}-${index}`}
                                className={`hover:bg-slate-800/30 transition-colors ${isBigNight ? 'bg-green-900/10' : ''
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
                                    <div className="text-slate-500 text-xs">
                                      {new Date(perf.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </div>
                                  </div>
                                </td>
                                <td className="p-3 text-center">
                                  <div className="flex items-center justify-center">
                                    <img
                                      src={`https://assets.nhle.com/logos/nhl/svg/${perf.nhlTeam}_dark.svg`}
                                      alt={perf.nhlTeam}
                                      className="w-6 h-6 opacity-80"
                                      onError={(e) => {
                                        const target = e.currentTarget as HTMLImageElement;
                                        target.style.display = 'none';
                                      }}
                                    />
                                  </div>
                                </td>
                                <td className={`p-3 text-center ${isBigNight ? 'text-white font-bold' : 'text-slate-400'}`}>{perf.stats.goals || 0}</td>
                                <td className={`p-3 text-center ${isBigNight ? 'text-white font-bold' : 'text-slate-400'}`}>{perf.stats.assists || 0}</td>
                                <td className={`p-3 text-center ${isBigNight ? 'text-white font-bold' : 'text-slate-400'}`}>{perf.stats.hits || 0}</td>
                                <td className={`p-3 text-center ${isBigNight ? 'text-white font-bold' : 'text-slate-400'}`}>{perf.stats.blockedShots || 0}</td>
                                <td className={`p-3 text-center ${isBigNight ? 'text-white font-bold' : 'text-slate-400'}`}>{perf.stats.wins || 0}</td>
                                <td className={`p-3 text-center ${isBigNight ? 'text-white font-bold' : 'text-slate-400'}`}>{perf.stats.saves || 0}</td>
                                <td className={`p-3 text-center ${isBigNight ? 'text-white font-bold' : 'text-slate-400'}`}>{perf.stats.shutouts || 0}</td>
                                <td className="p-3 text-center">
                                  <Badge variant={perf.points > 0 ? 'success' : perf.points < 0 ? 'danger' : 'default'}>
                                    {perf.points > 0 ? '+' : ''}{perf.points.toFixed(2)}
                                  </Badge>
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

          {/* How Scoring Works Info Box */}
          <div className="bg-blue-900/20 border-t border-blue-500/20 p-4 flex items-start gap-3">
            <div className="text-xl">💡</div>
            <p className="text-blue-200 text-sm leading-relaxed">
              <strong>How Scoring Works:</strong> Every day, the system automatically checks yesterday's NHL games and
              calculates fantasy points for your drafted players based on their real-life performance. Points are added
              to your team's total score.
            </p>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
