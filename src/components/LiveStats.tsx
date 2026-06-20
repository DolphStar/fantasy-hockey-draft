import { useState } from 'react';

import { useLeague } from '../context/LeagueContext';
import { useDraft } from '../context/DraftContext';
import { getHockeyDay } from '../utils/dateUtils';
import { GlassCard } from './ui/GlassCard';
import { Icon } from './ui/Icon';
import { Lightbulb, RefreshCw } from 'lucide-react';
import { SkeletonRow } from './ui/Skeleton';
import { LiveStatsHeader } from './live-stats/LiveStatsHeader';
import { TeamStatsTables } from './live-stats/TeamStatsTables';
import { MatchupsSection } from './live-stats/MatchupsSection';
import { useLiveStatsData } from './live-stats/useLiveStatsData';
import { useMatchups } from './live-stats/useMatchups';
import { useLiveStatsRefresh } from './live-stats/useLiveStatsRefresh';

interface LiveStatsProps {
  showAllTeams?: boolean; // If true, show all teams' stats (for Standings page)
}

export default function LiveStats({ showAllTeams = false }: LiveStatsProps = {}) {
  const { league } = useLeague();
  const { draftState } = useDraft();

  // Date navigation state
  const [selectedDate, setSelectedDate] = useState<string>(getHockeyDay());
  const todayDate = getHockeyDay();
  const isViewingToday = selectedDate === todayDate;

  const { liveStats, loading, lastUpdate } = useLiveStatsData({ selectedDate, isViewingToday, showAllTeams });
  const upcomingMatchups = useMatchups({ selectedDate });
  const { refreshing, secondsUntilRefresh } = useLiveStatsRefresh();

  // Date navigation helpers
  const goToPreviousDay = () => {
    const date = new Date(selectedDate + 'T12:00:00');
    date.setDate(date.getDate() - 1);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const goToNextDay = () => {
    const date = new Date(selectedDate + 'T12:00:00');
    date.setDate(date.getDate() + 1);
    const nextDate = date.toISOString().split('T')[0];
    // Don't go past today
    if (nextDate <= todayDate) {
      setSelectedDate(nextDate);
    }
  };

  const goToToday = () => {
    setSelectedDate(todayDate);
  };

  if (!league) {
    return null;
  }

  // Only show live stats when the league is active (draft complete)
  // Don't show during draft ('pending') or after season ends ('complete')
  if (league.status !== 'live' || !draftState?.isComplete) {
    return null;
  }

  const hasLiveStats = liveStats.length > 0;

  return (
    <GlassCard className="overflow-hidden mt-6">
      <LiveStatsHeader
        isViewingToday={isViewingToday}
        selectedDate={selectedDate}
        todayDate={todayDate}
        hasLiveStats={hasLiveStats}
        refreshing={refreshing}
        secondsUntilRefresh={secondsUntilRefresh}
        lastUpdate={lastUpdate}
        onPreviousDay={goToPreviousDay}
        onNextDay={goToNextDay}
        onToday={goToToday}
      />

      {loading ? (
        <div className="py-4">
          <SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow />
        </div>
      ) : (
        <>
          {/* Live Stats Section - Only show players with points > 0 */}
          {hasLiveStats && <TeamStatsTables liveStats={liveStats} />}

          {/* Matchups Section - Shows games for selected date */}
          <MatchupsSection
            selectedDate={selectedDate}
            isViewingToday={isViewingToday}
            upcomingMatchups={upcomingMatchups}
            liveStats={liveStats}
          />
        </>
      )}

      {/* Info Box */}
      <div className="bg-blue-900/20 border-t border-blue-500/20 p-4 flex items-start gap-3">
        <Icon as={Lightbulb} size="md" className="text-blue-300 shrink-0 mt-0.5" />
        <p className="text-blue-200 text-sm leading-relaxed">
          <strong className="font-semibold text-white">Auto-refresh:</strong> Stats update automatically every 5 minutes — use the{' '}
          <span className="inline-flex items-center gap-1 align-middle font-semibold text-blue-100">
            <Icon as={RefreshCw} size="sm" /> Refresh
          </span>{' '}
          control to update immediately. Fantasy points are calculated at end of day via daily scoring.
        </p>
      </div>
    </GlassCard>
  );
}
