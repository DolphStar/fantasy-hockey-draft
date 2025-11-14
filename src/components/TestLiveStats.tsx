import { useState } from 'react';
import { useLeague } from '../context/LeagueContext';
import { processLiveStats } from '../utils/liveStats';

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
    <div className="bg-gray-800 p-6 rounded-lg">
      <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
        🔴 Test Live Stats System
      </h3>
      <p className="text-gray-400 text-sm mb-4">
        Manually fetch today's live game stats to test the system. Stats will update in real-time on the Standings page.
      </p>
      
      <button
        onClick={handleRunLiveStats}
        disabled={loading}
        className={`w-full px-6 py-3 rounded-lg font-semibold transition-colors ${
          loading
            ? 'bg-gray-600 cursor-not-allowed'
            : 'bg-red-600 hover:bg-red-700 text-white'
        }`}
      >
        {loading ? '🔄 Updating Live Stats...' : '🔴 Update Live Stats Now'}
      </button>

      {result && (
        <div className={`mt-4 p-4 rounded ${
          result.startsWith('✅') 
            ? 'bg-green-900/30 text-green-300' 
            : 'bg-red-900/30 text-red-300'
        }`}>
          {result}
        </div>
      )}

      <div className="mt-4 p-4 bg-blue-900/30 border border-blue-500 rounded-lg">
        <p className="text-blue-200 text-sm">
          💡 <strong>Note:</strong> Live stats automatically update every 15 minutes during game hours (5 PM - 2 AM ET).
          <br />• Check the browser console for detailed logs
          <br />• Live stats appear on the Standings page
          <br />• In production, this runs automatically via cron job
        </p>
      </div>
    </div>
  );
}
