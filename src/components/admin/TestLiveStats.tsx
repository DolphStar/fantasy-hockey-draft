import { useState } from 'react';
import { useLeague } from '../../context/LeagueContext';
import { processLiveStats } from '../../utils/liveStats';
import { AdminPanel } from './AdminPanel';

export default function TestLiveStats() {
  const { league } = useLeague();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleRunLiveStats = async () => {
    if (!league) return;

    setLoading(true);
    setResult(null);

    try {
      console.log('🔴 Running live stats update...');
      const stats = await processLiveStats(league.id);

      const message = `✅ Live stats updated! Processed ${stats.gamesProcessed} games, updated ${stats.playersUpdated} players.`;
      setResult(message);
      console.log(message);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setResult(`❌ Error: ${errorMessage}`);
      console.error('Error running live stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!league) return null;

  return (
    <AdminPanel title="Live stats fetch" description="Pulls tonight’s in-progress box scores on demand.">

      <p className="text-slate-300 text-sm">
        Manually fetch today's live game stats to test the system. Stats will update in real-time on the Standings page.
      </p>

      <button
        onClick={handleRunLiveStats}
        disabled={loading}
        className={`w-full px-4 py-2.5 rounded-lg font-semibold transition-all text-sm ${loading
            ? 'bg-slate-700 cursor-not-allowed text-slate-400'
            : 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/20 active:scale-95'
          }`}
      >
        {loading ? '🔄 Updating Live Stats...' : '🔴 Update Live Stats Now'}
      </button>

      {result && (
        <div className={`p-3 rounded-lg text-sm ${result.startsWith('✅')
            ? 'bg-green-500/10 border border-green-500/30 text-green-200'
            : 'bg-red-500/10 border border-red-500/30 text-red-200'
          }`}>
          {result}
        </div>
      )}

      <div className="text-xs text-slate-400 bg-slate-900/30 p-3 rounded-lg space-y-1">
        <p>💡 <strong className="text-slate-300">Note:</strong> Live stats automatically update every 15 minutes during game hours (5 PM - 2 AM ET).</p>
        <p>• Check the browser console for detailed logs</p>
        <p>• Live stats appear on the Standings page</p>
        <p>• In production, this runs automatically via cron job</p>
      </div>
    </AdminPanel>
  );
}
