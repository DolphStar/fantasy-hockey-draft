import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useAuth } from '../../context/AuthContext';
import { useMemberships } from '../../context/MembershipContext';
import { createLeague } from '../../services/leagueService';
import { buildLeaguePath } from '../../lib/leaguePaths';
import { GlassCard } from '../ui/GlassCard';

export default function CreateLeague() {
  const { user } = useAuth();
  const { refresh } = useMemberships();
  const navigate = useNavigate();
  const [leagueName, setLeagueName] = useState('');
  const [myTeamName, setMyTeamName] = useState('');
  const [maxTeams, setMaxTeams] = useState(8);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !leagueName.trim() || !myTeamName.trim()) return;
    setBusy(true);
    try {
      const id = await createLeague(user, {
        leagueName: leagueName.trim(),
        teams: [{ teamName: myTeamName.trim(), ownerUid: user.uid, ownerEmail: user.email ?? undefined }],
        maxTeams: Number.isFinite(maxTeams) ? maxTeams : undefined,
      });
      refresh();
      toast.success('League created!');
      navigate(buildLeaguePath(id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create league');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen py-10 px-6 max-w-md mx-auto">
      <GlassCard className="p-5 space-y-3">
        <h1 className="text-xl font-bold text-white">Create a league</h1>
        <form onSubmit={submit} className="space-y-3">
          <input value={leagueName} onChange={(e) => setLeagueName(e.target.value)} placeholder="League name" className="w-full bg-slate-900/80 border border-white/15 rounded-lg px-3 py-2 text-sm text-white" />
          <input value={myTeamName} onChange={(e) => setMyTeamName(e.target.value)} placeholder="Your team name" className="w-full bg-slate-900/80 border border-white/15 rounded-lg px-3 py-2 text-sm text-white" />
          <label className="block text-sm text-gray-400">Max teams
            <input type="number" min={2} max={20} value={maxTeams} onChange={(e) => setMaxTeams(Number(e.target.value))} className="mt-1 w-full bg-slate-900/80 border border-white/15 rounded-lg px-3 py-2 text-sm text-white" />
          </label>
          <button type="submit" disabled={busy || !leagueName.trim() || !myTeamName.trim()} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg px-3 py-2 text-sm font-semibold">Create</button>
        </form>
      </GlassCard>
    </div>
  );
}
