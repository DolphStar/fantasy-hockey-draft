import { useState } from 'react';
import { useLeague } from '../../context/LeagueContext';
import { authedGet } from '../../services/apiClient';
import { getRecentNewYorkDateStrings } from '../../utils/dateUtils';
import { AdminPanel } from './AdminPanel';

const BACKFILL_WEEK_DAYS = 7;

export default function BackfillStats() {
  const { league, isAdmin } = useLeague();
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [targetDate, setTargetDate] = useState<string>('');

  // Backfill a single date — server writes to Firestore via Admin SDK.
  // The route needs an admin ID token plus a leagueId to check it against;
  // without both it answers 401 in production (it otherwise only accepts the
  // cron secret, which the browser must never hold).
  const backfillDate = async (dateStr: string): Promise<{ success: boolean; players: number }> => {
    if (!league) throw new Error('No league selected');

    const json = await authedGet(
      `/api/fetch-daily-stats?date=${encodeURIComponent(dateStr)}&leagueId=${encodeURIComponent(league.id)}`,
    );

    if (!json.success) {
      if (json.message?.includes('No completed games')) {
        return { success: true, players: 0 };
      }
      throw new Error(json.message || 'No data returned');
    }

    return { success: true, players: json.playerCount || 0 };
  };

  const handleBackfill = async () => {
    if (!targetDate) {
      setResult('❌ Please select a date');
      return;
    }

    try {
      setProcessing(true);
      setResult(`⏳ Fetching stats for ${targetDate}...`);

      const result = await backfillDate(targetDate);
      setResult(`✅ Successfully backfilled stats for ${targetDate}! (${result.players} players)`);
    } catch (error) {
      console.error('Error backfilling stats:', error);
      setResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setProcessing(false);
    }
  };

  // Backfill last 7 days
  const handleBackfillWeek = async () => {
    try {
      setProcessing(true);
      const results: string[] = [];

      // NHL stats are keyed by the New York date. Building this list from the
      // browser's clock (or toISOString(), which is UTC) requests the wrong day
      // for anyone outside US Eastern.
      const dates = getRecentNewYorkDateStrings(BACKFILL_WEEK_DAYS);

      for (const [index, dateStr] of dates.entries()) {
        setResult(`⏳ Processing ${dateStr} (${index + 1}/${dates.length})...`);

        try {
          const result = await backfillDate(dateStr);
          results.push(`${dateStr}: ${result.players} players`);
        } catch (err) {
          results.push(`${dateStr}: ❌ ${err instanceof Error ? err.message : 'Error'}`);
        }
      }

      setResult(`✅ Backfill complete!\n${results.join('\n')}`);
    } catch (error) {
      console.error('Error backfilling week:', error);
      setResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setProcessing(false);
    }
  };

  if (!isAdmin) return null;

  return (
    <AdminPanel title="Stats backfill" description="Re-imports historical NHL stats for a date range.">
      
      <p className="text-slate-300 text-sm">
        Manually fetch and save daily NHL stats to Firestore (nhl_daily_stats). This populates the "Hot Pickups" trend data.
      </p>

      <div className="space-y-2">
        <label className="block text-xs text-slate-400 uppercase font-bold">Target Date</label>
        <input
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
          className="w-full bg-slate-900/50 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:border-blue-500 outline-none"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleBackfill}
          disabled={processing || !targetDate}
          className={`flex-1 px-4 py-2.5 rounded-lg font-semibold transition-all text-sm ${
            processing || !targetDate
              ? 'bg-slate-700 cursor-not-allowed text-slate-400'
              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 active:scale-95'
          }`}
        >
          {processing ? '⏳ Processing...' : '📥 Run Backfill'}
        </button>
        
        <button
          onClick={handleBackfillWeek}
          disabled={processing}
          className={`px-4 py-2.5 rounded-lg font-semibold transition-all text-sm ${
            processing
              ? 'bg-slate-700 cursor-not-allowed text-slate-400'
              : 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-900/20 active:scale-95'
          }`}
          title="Backfill stats for the last 7 days"
        >
          📅 Last 7 Days
        </button>
      </div>

      {result && (
        <div className={`p-3 rounded-lg text-sm whitespace-pre-line ${
          result.startsWith('✅') ? 'bg-green-500/10 border border-green-500/30 text-green-200' :
          result.startsWith('❌') ? 'bg-red-500/10 border border-red-500/30 text-red-200' :
          'bg-slate-800/50 border border-slate-700 text-slate-300'
        }`}>
          {result}
        </div>
      )}
    </AdminPanel>
  );
}
