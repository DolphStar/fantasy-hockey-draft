import { Badge } from '../ui/Badge';

import { formatCountdown, formatDisplayDate } from './liveStatsUtils';

interface LiveStatsHeaderProps {
  isViewingToday: boolean;
  selectedDate: string;
  todayDate: string;
  hasLiveStats: boolean;
  refreshing: boolean;
  secondsUntilRefresh: number;
  lastUpdate: Date | null;
  onPreviousDay: () => void;
  onNextDay: () => void;
  onToday: () => void;
}

export function LiveStatsHeader({
  isViewingToday,
  selectedDate,
  todayDate,
  hasLiveStats,
  refreshing,
  secondsUntilRefresh,
  lastUpdate,
  onPreviousDay,
  onNextDay,
  onToday,
}: LiveStatsHeaderProps) {
  return (
    <div className="p-6 pb-4 border-b border-slate-700/50 bg-slate-900/30">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          {isViewingToday ? (
            <>
              <div className="relative">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <div className="absolute inset-0 w-3 h-3 bg-red-500 rounded-full animate-ping opacity-75"></div>
              </div>
              <h3 className="text-xl font-bold text-white">Live Stats - Today's Games</h3>
              {hasLiveStats && (
                <Badge variant="danger" className="animate-pulse">LIVE</Badge>
              )}
            </>
          ) : (
            <>
              <span className="text-2xl">📅</span>
              <h3 className="text-xl font-bold text-white">Game History - {formatDisplayDate(selectedDate)}</h3>
              <Badge variant="default">FINAL</Badge>
            </>
          )}
          {refreshing && (
            <span className="animate-spin text-blue-400 text-lg">🔄</span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Date Navigation */}
          <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg p-1">
            <button
              onClick={onPreviousDay}
              className="px-2 py-1 rounded text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
              title="Previous day"
            >
              ◀
            </button>
            <span className="px-3 py-1 text-sm font-medium text-white min-w-[100px] text-center">
              {formatDisplayDate(selectedDate)}
            </span>
            <button
              onClick={onNextDay}
              disabled={selectedDate >= todayDate}
              className={`px-2 py-1 rounded transition-colors ${
                selectedDate >= todayDate
                  ? 'text-slate-600 cursor-not-allowed'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
              title="Next day"
            >
              ▶
            </button>
            {!isViewingToday && (
              <button
                onClick={onToday}
                className="px-2 py-1 rounded text-xs bg-blue-600 hover:bg-blue-500 text-white transition-colors"
              >
                Today
              </button>
            )}
          </div>

          {/* Countdown Timer - only show for today */}
          {isViewingToday && (
            <div className="text-center hidden sm:block">
              <p className="text-slate-400 text-xs">Next refresh in</p>
              <p className="text-green-400 text-sm font-mono font-bold">{formatCountdown(secondsUntilRefresh)}</p>
            </div>
          )}


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
  );
}
