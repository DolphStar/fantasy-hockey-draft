import { useState } from 'react';
import { useLeague } from '../context/LeagueContext';
import { processYesterdayScores } from '../utils/scoringEngine';
import { db } from '../firebase';
import { collection, getDocs, writeBatch } from 'firebase/firestore';
import { GlassCard } from './ui/GlassCard';

export default function TestScoring() {
  const { league, isAdmin } = useLeague();
  const [processing, setProcessing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [targetDate, setTargetDate] = useState<string>('');

  const hasRules = league?.scoringRules !== undefined;

  const handleRunScoring = async () => {
    if (!league) {
      setResult('❌ No league found');
      return;
    }

    if (!hasRules) {
      setResult('❌ League needs scoring rules first. Run: addScoringRulesToLeague("' + league.id + '") in console');
      return;
    }

    try {
      setProcessing(true);
      setResult(`⏳ Processing games for ${targetDate || 'yesterday'}...`);

      await processYesterdayScores(league.id, targetDate || undefined);

      setResult('✅ Scoring complete! Check Standings page for updated scores.');
    } catch (error) {
      console.error('Error running scoring:', error);
      setResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleClearScores = async () => {
    if (!league) {
      setResult('❌ No league found');
      return;
    }

    const confirmed = window.confirm(
      '⚠️ Clear ALL scores and processed dates?\n\n' +
      'This will:\n' +
      '• Reset all team scores to 0\n' +
      '• Delete all player daily scores\n' +
      '• Clear processed dates (allows re-running scoring)\n\n' +
      'Are you sure?'
    );

    if (!confirmed) return;

    try {
      setClearing(true);
      setResult('⏳ Clearing all scores...');

      // Clear team scores
      const teamScoresRef = collection(db, `leagues/${league.id}/teamScores`);
      const teamScoresSnap = await getDocs(teamScoresRef);

      const batch = writeBatch(db);
      let deleteCount = 0;

      teamScoresSnap.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
        deleteCount++;
      });

      // Clear player daily scores
      const playerScoresRef = collection(db, `leagues/${league.id}/playerDailyScores`);
      const playerScoresSnap = await getDocs(playerScoresRef);

      playerScoresSnap.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
        deleteCount++;
      });

      // Clear processed dates (allows re-running scoring)
      const processedDatesRef = collection(db, `leagues/${league.id}/processedDates`);
      const processedDatesSnap = await getDocs(processedDatesRef);

      processedDatesSnap.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
        deleteCount++;
      });

      await batch.commit();

      setResult(`✅ Cleared ${deleteCount} documents. You can now re-run scoring.`);
    } catch (error) {
      console.error('Error clearing scores:', error);
      setResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setClearing(false);
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <GlassCard className="p-5 space-y-4">
      <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-700/50 pb-2">
        <span>🧪</span> Test Scoring System
      </h3>

      {!hasRules && (
        <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-lg text-sm">
          <p className="text-amber-200 font-bold mb-1">⚠️ Scoring Rules Not Configured</p>
          <p className="text-amber-100/80 text-xs">Open console (F12) and run:</p>
          <code className="block bg-slate-900/80 p-2 rounded mt-2 text-amber-300 text-xs font-mono">
            addScoringRulesToLeague("{league?.id}")
          </code>
        </div>
      )}

      <p className="text-slate-300 text-sm">
        Manually trigger game scoring. Leave date empty to process yesterday's games, or select a specific date to backfill/retry.
      </p>

      <div className="space-y-2">
        <label className="block text-xs text-slate-400 uppercase font-bold">Target Date (Optional)</label>
        <input
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
          className="w-full bg-slate-900/50 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:border-blue-500 outline-none"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleRunScoring}
          disabled={processing || clearing}
          className={`flex-1 px-4 py-2.5 rounded-lg font-semibold transition-all text-sm ${processing || clearing
            ? 'bg-slate-700 cursor-not-allowed text-slate-400'
            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 active:scale-95'
            }`}
        >
          {processing ? '⏳ Processing...' : targetDate ? `▶️ Run Scoring for ${targetDate}` : '▶️ Run Yesterday\'s Scoring'}
        </button>

        <button
          onClick={handleClearScores}
          disabled={processing || clearing}
          className={`flex-1 px-4 py-2.5 rounded-lg font-semibold transition-all text-sm ${processing || clearing
            ? 'bg-slate-700 cursor-not-allowed text-slate-400'
            : 'bg-red-900/40 hover:bg-red-900/60 text-red-300 border border-red-900/50 active:scale-95'
            }`}
        >
          {clearing ? '⏳ Clearing...' : '🗑️ Clear Scores'}
        </button>
      </div>

      {result && (
        <div className={`p-3 rounded-lg text-sm ${result.startsWith('✅') ? 'bg-green-500/10 border border-green-500/30 text-green-200' :
          result.startsWith('❌') ? 'bg-red-500/10 border border-red-500/30 text-red-200' :
            'bg-slate-800/50 border border-slate-700 text-slate-300'
          }`}>
          {result}
        </div>
      )}

      <div className="text-xs text-slate-400 bg-slate-900/30 p-3 rounded-lg space-y-1">
        <p>ℹ️ <strong className="text-slate-300">Note:</strong> This will process all NHL games from yesterday and calculate points.</p>
        <p>• Check the browser console for detailed logs</p>
        <p>• Results will appear in the Standings page</p>
        <p>• In production, this runs automatically every day at 5 AM UTC</p>
      </div>
    </GlassCard>
  );
}
