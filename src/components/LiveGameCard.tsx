import type { GameWithPlayers } from '../hooks/useGroupedGames';

interface LiveGameCardProps {
  game: GameWithPlayers;
}

export default function LiveGameCard({ game }: LiveGameCardProps) {
  const { awayTeam, homeTeam, period, clock, fantasyPlayers } = game;

  return (
    <div className="bg-gray-800 rounded-lg border border-red-500/50 overflow-hidden">
      {/* Game Header */}
      <div className="bg-gradient-to-r from-red-900/30 to-red-800/30 p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          {/* Away Team */}
          <div className="flex items-center gap-3">
            <img
              src={`https://assets.nhle.com/logos/nhl/svg/${awayTeam.abbrev}_dark.svg`}
              alt={awayTeam.abbrev}
              className="w-12 h-12"
            />
            <div>
              <p className="text-white font-bold text-xl">{awayTeam.abbrev}</p>
              <p className="text-3xl font-bold text-white">{awayTeam.score || 0}</p>
            </div>
          </div>

          {/* Game Status */}
          <div className="text-center">
            <span className="inline-flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold animate-pulse">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
              LIVE
            </span>
            {period && (
              <p className="text-gray-300 text-sm mt-1">
                Period {period} {clock?.timeRemaining && `• ${clock.timeRemaining}`}
              </p>
            )}
          </div>

          {/* Home Team */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-white font-bold text-xl">{homeTeam.abbrev}</p>
              <p className="text-3xl font-bold text-white">{homeTeam.score || 0}</p>
            </div>
            <img
              src={`https://assets.nhle.com/logos/nhl/svg/${homeTeam.abbrev}_dark.svg`}
              alt={homeTeam.abbrev}
              className="w-12 h-12"
            />
          </div>
        </div>
      </div>

      {/* Fantasy Players Stats Table */}
      <div className="p-4">
        <h4 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wide">
          Your Players ({fantasyPlayers.length})
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="text-left p-2 text-gray-400 font-medium text-xs">Player</th>
                <th className="text-center p-2 text-gray-400 font-medium text-xs">⚽ G</th>
                <th className="text-center p-2 text-gray-400 font-medium text-xs">🎯 A</th>
                <th className="text-center p-2 text-gray-400 font-medium text-xs">💥 H</th>
                <th className="text-center p-2 text-gray-400 font-medium text-xs">🛡️ BS</th>
                <th className="text-center p-2 text-gray-400 font-medium text-xs">📊 Pts</th>
              </tr>
            </thead>
            <tbody>
              {fantasyPlayers.map(player => (
                <tr key={player.playerId} className="border-t border-gray-700">
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <img
                        src={`https://assets.nhle.com/mugs/nhl/20242025/${player.nhlTeam}/${player.playerId}.png`}
                        alt={player.name}
                        onError={(e) => {
                          e.currentTarget.src = 'https://assets.nhle.com/mugs/nhl/default-skater.png';
                        }}
                        className="w-8 h-8 rounded-full"
                      />
                      <span className="text-white text-sm font-medium">{player.name}</span>
                    </div>
                  </td>
                  <td className="p-2 text-center text-gray-300 text-sm">-</td>
                  <td className="p-2 text-center text-gray-300 text-sm">-</td>
                  <td className="p-2 text-center text-gray-300 text-sm">-</td>
                  <td className="p-2 text-center text-gray-300 text-sm">-</td>
                  <td className="p-2 text-center text-green-400 font-bold text-sm">0.00</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
