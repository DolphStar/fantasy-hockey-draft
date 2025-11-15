import { useState } from 'react';
import { useLeague } from '../context/LeagueContext';
import { processYesterdayScores } from '../utils/scoringEngine';
import { db } from '../firebase';
import { collection, getDocs, writeBatch } from 'firebase/firestore';

export default function TestScoring() {
  const { league, isAdmin } = useLeague();
  const [processing, setProcessing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  
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
      setResult('⏳ Processing yesterday\'s games...');
      
      await processYesterdayScores(league.id);
      
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
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-blue-900/30 border border-blue-500 p-6 rounded-lg">
        <h2 className="text-2xl font-bold text-white mb-4">🧪 Test Scoring System</h2>
        
        {!hasRules && (
          <div className="bg-yellow-900/50 border border-yellow-500 p-4 rounded-lg mb-4">
            <p className="text-yellow-200 font-semibold mb-2">⚠️ Scoring Rules Not Configured</p>
            <p className="text-yellow-100 text-sm mb-2">Your league needs scoring rules before scoring can run.</p>
            <p className="text-yellow-100 text-sm">Open browser console (F12) and run:</p>
            <code className="block bg-black/50 p-2 rounded mt-2 text-yellow-300 text-sm">
              addScoringRulesToLeague("{league?.id}")
            </code>
            <p className="text-yellow-100 text-sm mt-2">Then refresh the page.</p>
          </div>
        )}
        
        <p className="text-gray-300 mb-4">
          Manually trigger yesterday's game scoring to test the system.
          This will calculate fantasy points for all drafted players based on their real NHL performance.
        </p>
        
        <div className="flex gap-3">
          <button
            onClick={handleRunScoring}
            disabled={processing || clearing}
            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
              processing || clearing
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {processing ? '⏳ Processing...' : '▶️ Run Yesterday\'s Scoring'}
          </button>

          <button
            onClick={handleClearScores}
            disabled={processing || clearing}
            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
              processing || clearing
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
          >
            {clearing ? '⏳ Clearing...' : '🗑️ Clear Scores'}
          </button>
        </div>
        
        {result && (
          <div className={`mt-4 p-4 rounded-lg ${
            result.startsWith('✅') ? 'bg-green-900/50 border border-green-500' :
            result.startsWith('❌') ? 'bg-red-900/50 border border-red-500' :
            'bg-gray-800 border border-gray-600'
          }`}>
            <p className="text-white">{result}</p>
          </div>
        )}
        
        <div className="mt-4 text-sm text-gray-400">
          <p>ℹ️ <strong>Note:</strong> This will process all NHL games from yesterday and calculate points.</p>
          <p className="mt-1">• Check the browser console for detailed logs</p>
          <p>• Results will appear in the Standings page</p>
          <p>• In production, this runs automatically every day at 5 AM UTC</p>
        </div>
      </div>
    </div>
  );
}
