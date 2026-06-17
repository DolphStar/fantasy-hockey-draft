import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { useMemberships } from '../../context/MembershipContext';
import { joinLeagueByCode } from '../../services/membershipService';
import { buildLeaguePath } from '../../lib/leaguePaths';
import { GlassCard } from '../ui/GlassCard';

export default function JoinByLink() {
  const [params] = useSearchParams();
  const code = params.get('code') ?? '';
  const { refresh } = useMemberships();
  const navigate = useNavigate();
  const [teamName, setTeamName] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !teamName.trim()) return;
    setBusy(true);
    try {
      const leagueId = await joinLeagueByCode(code, teamName.trim());
      refresh();
      toast.success('Joined league!');
      navigate(buildLeaguePath(leagueId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to join');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen py-10 px-6 max-w-md mx-auto">
      <GlassCard className="p-5 space-y-3">
        <h1 className="text-xl font-bold text-white">Join league</h1>
        {code ? (
          <form onSubmit={submit} className="space-y-3">
            <p className="text-gray-400 text-sm">Invite code: <span className="font-mono text-slate-200">{code}</span></p>
            <input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Your team name" className="w-full bg-slate-900/80 border border-white/15 rounded-lg px-3 py-2 text-sm text-white" />
            <button type="submit" disabled={busy || !teamName.trim()} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg px-3 py-2 text-sm font-semibold">Join</button>
          </form>
        ) : (
          <p className="text-gray-400 text-sm">No invite code in this link.</p>
        )}
      </GlassCard>
    </div>
  );
}
