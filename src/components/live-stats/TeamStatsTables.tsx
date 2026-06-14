import { Badge } from '../ui/Badge';
import type { LivePlayerStats } from '../../utils/liveStats';

interface TeamStatsTablesProps {
  liveStats: LivePlayerStats[];
}

/** Per-team tables of today's scoring players (points > 0). */
export function TeamStatsTables({ liveStats }: TeamStatsTablesProps) {
  // Group stats by team
  const statsByTeam = liveStats.reduce((acc, stat) => {
    if (!acc[stat.teamName]) {
      acc[stat.teamName] = [];
    }
    acc[stat.teamName].push(stat);
    return acc;
  }, {} as Record<string, LivePlayerStats[]>);

  return (
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
  );
}
