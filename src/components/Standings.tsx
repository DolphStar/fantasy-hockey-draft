import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { useLeague } from '../context/LeagueContext';
import type { TeamScore } from '../utils/scoringEngine';

export default function Standings() {
  const { league } = useLeague();
  const [standings, setStandings] = useState<TeamScore[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch standings
  useEffect(() => {
    if (!league) {
      setLoading(false);
      return;
    }

    const fetchStandings = async () => {
      try {
        setLoading(true);
        
        const standingsQuery = query(
          collection(db, `leagues/${league.id}/teamScores`),
          orderBy('totalPoints', 'desc')
        );
        
        const snapshot = await getDocs(standingsQuery);
        const standingsData = snapshot.docs.map(doc => ({
          ...doc.data()
        })) as TeamScore[];
        
        setStandings(standingsData);
      } catch (error) {
        console.error('Error fetching standings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStandings();
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
