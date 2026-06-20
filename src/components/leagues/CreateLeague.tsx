import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { useMemberships } from '../../context/MembershipContext';
import { createLeague } from '../../services/leagueService';
import { buildLeaguePath } from '../../lib/leaguePaths';
import { GlassCard } from '../ui/GlassCard';
import { GlowBackdrop } from '../ui/GlowBackdrop';
import { Logo } from '../ui/Logo';
import { Icon } from '../ui/Icon';

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

  const inputCls =
    'w-full bg-slate-900/80 border border-white/15 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-colors';

  return (
    <div className="min-h-screen px-5 py-8 max-w-md mx-auto flex flex-col">
      <GlowBackdrop />

      <header className="flex items-center justify-between mb-8">
        <Link to="/leagues" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
          <Icon as={ArrowLeft} size="sm" /> My Leagues
        </Link>
        <Logo className="w-9 h-9" />
      </header>

      <div className="flex-1 flex flex-col justify-center pb-12">
        <h1 className="text-3xl font-bold text-white mb-1">Create a league</h1>
        <p className="text-slate-400 mb-6">Name it, pick a size, and you're the commissioner.</p>

        <GlassCard className="p-5">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">League name</label>
              <input value={leagueName} onChange={(e) => setLeagueName(e.target.value)} placeholder="e.g. The Frozen Five" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Your team name</label>
              <input value={myTeamName} onChange={(e) => setMyTeamName(e.target.value)} placeholder="e.g. Ice Breakers" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Max teams</label>
              <input type="number" min={2} max={20} value={maxTeams} onChange={(e) => setMaxTeams(Number(e.target.value))} className={inputCls} />
            </div>
            <button
              type="submit"
              disabled={busy || !leagueName.trim() || !myTeamName.trim()}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors"
            >
              {busy ? 'Creating…' : 'Create league'}
            </button>
          </form>
        </GlassCard>
      </div>
    </div>
  );
}
