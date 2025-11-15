import type { GameWithPlayers } from '../hooks/useGroupedGames';

interface UpcomingGameCardProps {
  game: GameWithPlayers;
}

export default function UpcomingGameCard({ game }: UpcomingGameCardProps) {
  const { awayTeam, homeTeam, startTimeUTC, fantasyPlayers } = game;

  // Format game time
  const gameTime = new Date(startTimeUTC).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  return (
    <div className="bg-gray-750 rounded-lg border border-gray-700 hover:border-blue-500 transition-colors p-4">
      {/* Game Matchup Header */}
      <div className="flex items-center justify-between mb-3">
        {/* Away Team Logo */}
        <img
          src={`https://assets.nhle.com/logos/nhl/svg/${awayTeam.abbrev}_dark.svg`}
          alt={awayTeam.abbrev}
          className="w-10 h-10"
        />

        {/* Game Time */}
        <div className="text-center">
          <p className="text-gray-400 text-xs">Game Time</p>
          <p className="text-green-400 font-bold text-sm">{gameTime}</p>
        </div>

        {/* Home Team Logo */}
        <img
          src={`https://assets.nhle.com/logos/nhl/svg/${homeTeam.abbrev}_dark.svg`}
          alt={homeTeam.abbrev}
          className="w-10 h-10"
        />
      </div>

      {/* Matchup Text */}
      <p className="text-center text-white font-semibold text-sm mb-3">
        {awayTeam.abbrev} <span className="text-gray-500">@</span> {homeTeam.abbrev}
      </p>

      {/* Your Players */}
      <div className="border-t border-gray-700 pt-3">
        <p className="text-gray-400 text-xs mb-2">Your Players:</p>
        <div className="flex flex-wrap gap-2">
          {fantasyPlayers.map(player => (
            <div
              key={player.playerId}
              className="flex items-center gap-1.5 bg-gray-800 px-2 py-1 rounded border border-gray-600"
            >
              <img
                src={`https://assets.nhle.com/mugs/nhl/20242025/${player.nhlTeam}/${player.playerId}.png`}
                alt={player.name}
                onError={(e) => {
                  e.currentTarget.src = 'https://assets.nhle.com/mugs/nhl/default-skater.png';
                }}
                className="w-6 h-6 rounded-full"
              />
              <span className="text-white text-xs font-medium">{player.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
