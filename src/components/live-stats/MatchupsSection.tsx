import type { LivePlayerStats } from '../../utils/liveStats';
import type { PlayerMatchup } from '../../utils/nhlSchedule';

import { GameCard } from './GameCard';
import { formatDisplayDate, groupAndSortMatchups } from './liveStatsUtils';

interface MatchupsSectionProps {
  selectedDate: string;
  isViewingToday: boolean;
  upcomingMatchups: PlayerMatchup[];
  liveStats: LivePlayerStats[];
}

/** Grid of the user's games for the selected date (live first, then by time). */
export function MatchupsSection({
  selectedDate,
  isViewingToday,
  upcomingMatchups,
  liveStats,
}: MatchupsSectionProps) {
  const hasLiveStats = liveStats.length > 0;
  const games = groupAndSortMatchups(upcomingMatchups, liveStats);

  return (
    <div className={`p-6 ${hasLiveStats ? 'border-t border-slate-700/50' : ''}`}>
      <div className="text-center py-4 mb-4">
        <h4 className="text-xl font-bold text-white mb-2 flex items-center justify-center gap-2">
          <span>🏒</span> {isViewingToday ? "Today's Matchups" : `Matchups - ${formatDisplayDate(selectedDate)}`}
        </h4>
        <p className="text-slate-400 text-sm">
          {isViewingToday ? "Your players' games for today" : `Your players' games for ${formatDisplayDate(selectedDate)}`}
        </p>
      </div>

      {upcomingMatchups.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto">
          {games.map(([gameKey, game]) => (
            <GameCard key={gameKey} game={game} liveStats={liveStats} />
          ))}
        </div>
      ) : (
        <div className="text-slate-500 text-center py-8 bg-slate-900/20 rounded-lg border border-slate-800 border-dashed">
          <p className="text-lg">No games for your active roster today.</p>
          <p className="text-sm mt-2">Check back tomorrow for upcoming matchups!</p>
        </div>
      )}
    </div>
  );
}
