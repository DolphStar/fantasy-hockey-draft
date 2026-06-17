import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useAuth } from '../../context/AuthContext';
import { useMemberships } from '../../context/MembershipContext';
import { joinLeagueByCode, leaveLeague } from '../../services/membershipService';
import { buildLeaguePath } from '../../lib/leaguePaths';
import { GlassCard } from '../ui/GlassCard';

export default function LeaguesHub() {
  const { signOut } = useAuth();
  const { memberships, loading, refresh } = useMemberships();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [busy, setBusy] = useState(false);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !teamName.trim()) return;
    setBusy(true);
    try {
      const leagueId = await joinLeagueByCode(code.trim(), teamName.trim());
      refresh();
      toast.success('Joined league!');
      navigate(buildLeaguePath(leagueId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to join');
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = async (leagueId: string) => {
    setBusy(true);
    try {
      await leaveLeague(leagueId);
      refresh();
      toast.success('Left league');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to leave');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen py-10 px-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">My Leagues</h1>
        <button onClick={() => signOut()} className="text-sm text-gray-400 hover:text-white border border-white/10 hover:border-white/30 rounded-lg px-3 py-1.5">Sign Out</button>
      </div>

      <GlassCard className="p-4 space-y-2">
        {loading ? (
          <p className="text-gray-400 text-sm">Loading…</p>
        ) : memberships.length === 0 ? (
          <p className="text-gray-400 text-sm">You're not in any leagues yet. Create one or join with an invite code below.</p>
        ) : (
          memberships.map((m) => (
            <div key={m.id} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
              <Link to={buildLeaguePath(m.id)} className="font-semibold text-blue-400 hover:text-blue-300">{m.leagueName}</Link>
              <button disabled={busy} onClick={() => handleLeave(m.id)} className="text-xs text-gray-400 hover:text-live">Leave</button>
            </div>
          ))
        )}
      </GlassCard>

      <GlassCard className="p-4 space-y-3">
        <h2 className="font-semibold text-white">Join a league</h2>
        <form onSubmit={handleJoin} className="space-y-2">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Invite code" className="w-full bg-slate-900/80 border border-white/15 rounded-lg px-3 py-2 text-sm text-white" />
          <input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Your team name" className="w-full bg-slate-900/80 border border-white/15 rounded-lg px-3 py-2 text-sm text-white" />
          <button type="submit" disabled={busy || !code.trim() || !teamName.trim()} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg px-3 py-2 text-sm font-semibold">Join</button>
        </form>
      </GlassCard>

      <GlassCard className="p-4">
        <h2 className="font-semibold text-white mb-1">Create a league</h2>
        <p className="text-gray-400 text-sm mb-3">Start a new league and invite others with a code.</p>
        <Link to="/leagues/new" className="inline-block bg-slate-800 hover:bg-slate-700 text-white rounded-lg px-3 py-2 text-sm font-semibold">Create league</Link>
      </GlassCard>
    </div>
  );
}
