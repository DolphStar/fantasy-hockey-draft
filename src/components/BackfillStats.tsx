import { useState } from 'react';
import { useLeague } from '../context/LeagueContext';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { GlassCard } from './ui/GlassCard';

export default function BackfillStats() {
  const { isAdmin } = useLeague();
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [targetDate, setTargetDate] = useState<string>('');

  const handleBackfill = async () => {
    if (!targetDate) {
      setResult('❌ Please select a date');
      return;
    }

    try {
      setProcessing(true);
      setResult(`⏳ Fetching stats for ${targetDate}...`);

      // 1. Call API in returnOnly mode
      const response = await fetch(`/api/fetch-daily-stats?date=${targetDate}&returnOnly=true`);
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const json = await response.json();
      if (!json.success || !json.data) {
        throw new Error(json.message || 'No data returned');
      }

      // 2. Write to Firestore using authenticated client
      setResult(`⏳ Writing ${Object.keys(json.data.players).length} records to Firestore...`);
      
      const docRef = doc(db, 'nhl_daily_stats', targetDate);
      await setDoc(docRef, json.data);

      setResult(`✅ Successfully backfilled stats for ${targetDate}! (${Object.keys(json.data.players).length} players)`);
    } catch (error) {
      console.error('Error backfilling stats:', error);
      setResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setProcessing(false);
    }
  };

  if (!isAdmin) return null;

  return (
    <GlassCard className="p-5 space-y-4">
      <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-700/50 pb-2">
        <span>📥</span> Backfill NHL Stats
      </h3>
      
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

      <button
        onClick={handleBackfill}
        disabled={processing || !targetDate}
        className={`w-full px-4 py-2.5 rounded-lg font-semibold transition-all text-sm ${
          processing || !targetDate
            ? 'bg-slate-700 cursor-not-allowed text-slate-400'
            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 active:scale-95'
        }`}
      >
        {processing ? '⏳ Processing...' : '📥 Run Backfill'}
      </button>

      {result && (
        <div className={`p-3 rounded-lg text-sm ${
          result.startsWith('✅') ? 'bg-green-500/10 border border-green-500/30 text-green-200' :
          result.startsWith('❌') ? 'bg-red-500/10 border border-red-500/30 text-red-200' :
          'bg-slate-800/50 border border-slate-700 text-slate-300'
        }`}>
          {result}
        </div>
      )}
    </GlassCard>
  );
}
