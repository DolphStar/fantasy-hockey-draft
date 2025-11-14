import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { useLeague } from '../context/LeagueContext';
import type { TeamScore } from '../utils/scoringEngine';
import LiveStats from './LiveStats';
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

      {/* Scoring Rules Info */}
      {league.scoringRules && (
        <div className="bg-gray-800 p-4 rounded-lg mb-6">
          <h3 className="text-lg font-semibold text-white mb-2">📊 Scoring Rules</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm text-gray-300">
            <div>
              <p className="font-semibold text-white mb-1">Skaters</p>
              <p>Goal: {league.scoringRules.goal}pt</p>
              <p>Assist: {league.scoringRules.assist}pt</p>
              <p>SH Goal: +{league.scoringRules.shortHandedGoal}pt</p>
              <p>OT Goal: +{league.scoringRules.overtimeGoal}pt</p>
              <p>Fight: {league.scoringRules.fight}pts</p>
            </div>
            <div>
              <p className="font-semibold text-white mb-1">Defense</p>
              <p>Blocked Shot: {league.scoringRules.blockedShot}pt</p>
              <p>Hit: {league.scoringRules.hit}pt</p>
            </div>
            <div>
              <p className="font-semibold text-white mb-1">Goalies</p>
              <p>Win: {league.scoringRules.win}pt</p>
              <p>Shutout: {league.scoringRules.shutout}pts</p>
              <p>Save: {league.scoringRules.save}pt</p>
              <p>Assist: {league.scoringRules.goalieAssist}pt</p>
              <p>Goal: {league.scoringRules.goalieGoal}pts!</p>
            </div>
          </div>
        </div>
      )}

      {/* Standings Table */}
      <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
        <h3 className="text-xl font-semibold p-6 pb-4 text-white">Current Standings</h3>
        
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
                  <th className="text-center p-4 text-gray-300 font-semibold">W</th>
                  <th className="text-center p-4 text-gray-300 font-semibold">L</th>
                  <th className="text-left p-4 text-gray-300 font-semibold">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((team, index) => {
                  const isFirst = index === 0;
                  const isLast = index === standings.length - 1;
                  
                  return (
                    <tr
                      key={team.teamName}
                      className={`border-t border-gray-700 hover:bg-gray-750 transition-colors ${
                        isFirst ? 'bg-yellow-900/20' : ''
                      } ${isLast ? 'bg-red-900/10' : ''}`}
                    >
                      <td className="p-4">
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
                      </td>
                      <td className="p-4">
                        <span className="text-white font-semibold">{team.teamName}</span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-2xl font-bold text-green-400">
                          {team.totalPoints.toFixed(2)}
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
                            <th className="text-center p-3 text-gray-400 font-medium text-sm">🏹 S</th>
                            <th className="text-center p-3 text-gray-400 font-medium text-sm">💥 H</th>
                            <th className="text-center p-3 text-gray-400 font-medium text-sm">🛡️ BS</th>
                            <th className="text-center p-3 text-gray-400 font-medium text-sm">🏆 W</th>
                            <th className="text-center p-3 text-gray-400 font-medium text-sm">🥅 Sv</th>
                            <th className="text-center p-3 text-gray-400 font-medium text-sm">🚫 SO</th>
                            <th className="text-center p-3 text-gray-400 font-medium text-sm font-bold">Points</th>
                          </tr>
                        </thead>
                        <tbody>
                          {teamPerfs.map((perf, index) => (
                            <tr
                              key={`${perf.playerId}-${perf.date}-${index}`}
                              className="border-t border-gray-700 hover:bg-gray-700/30 transition-colors"
                            >
                              <td className="p-3">
                                <div>
                                  <div className="text-white font-medium">{perf.playerName}</div>
                                  <div className="text-gray-500 text-xs">
                                    {new Date(perf.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </div>
                                </div>
                              </td>
                              <td className="p-3 text-center">
                                <span className="text-gray-400 text-sm font-mono">{perf.nhlTeam}</span>
                              </td>
                              <td className="p-3 text-center text-gray-300">{perf.stats.goals || 0}</td>
                              <td className="p-3 text-center text-gray-300">{perf.stats.assists || 0}</td>
                              <td className="p-3 text-center text-gray-300">{perf.stats.shots || 0}</td>
                              <td className="p-3 text-center text-gray-300">{perf.stats.hits || 0}</td>
                              <td className="p-3 text-center text-gray-300">{perf.stats.blockedShots || 0}</td>
                              <td className="p-3 text-center text-gray-300">{perf.stats.wins || 0}</td>
                              <td className="p-3 text-center text-gray-300">{perf.stats.saves || 0}</td>
                              <td className="p-3 text-center text-gray-300">{perf.stats.shutouts || 0}</td>
                              <td className="p-3 text-center">
                                <span className={`text-base font-bold ${
                                  perf.points > 0 ? 'text-green-400' : perf.points < 0 ? 'text-red-400' : 'text-gray-400'
                                }`}>
                                  {perf.points > 0 ? '+' : ''}{perf.points.toFixed(2)}
                                </span>
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
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-900/30 border border-blue-500 p-4 rounded-lg mt-6">
        <p className="text-blue-200 text-sm">
          💡 <strong>How Scoring Works:</strong> Every day, the system automatically checks yesterday's NHL games and 
          calculates fantasy points for your drafted players based on their real-life performance. Points are added 
          to your team's total score.
        </p>
      </div>
    </div>
  );
}
