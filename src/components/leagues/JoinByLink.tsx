import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Ticket } from 'lucide-react';

import { useMemberships } from '../../context/MembershipContext';
import { joinLeagueByCode } from '../../services/membershipService';
import { buildLeaguePath } from '../../lib/leaguePaths';
import { GlassCard } from '../ui/GlassCard';
import { GlowBackdrop } from '../ui/GlowBackdrop';
import { Logo } from '../ui/Logo';
import { Icon } from '../ui/Icon';

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
    <div className="min-h-screen px-5 py-8 max-w-md mx-auto flex flex-col">
      <GlowBackdrop />

      <header className="flex items-center justify-between mb-8">
        <Link to="/leagues" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
          <Icon as={ArrowLeft} size="sm" /> My Leagues
        </Link>
        <Logo className="w-9 h-9" />
      </header>

      <div className="flex-1 flex flex-col justify-center pb-12">
        <h1 className="text-3xl font-bold text-white mb-1">Join a league</h1>
        <p className="text-slate-400 mb-6">You've been invited — claim your team.</p>

        <GlassCard className="p-5">
          {code ? (
            <form onSubmit={submit} className="space-y-4">
              <div className="flex items-center gap-2 text-sm bg-slate-900/60 border border-white/10 rounded-lg px-3 py-2.5">
                <Icon as={Ticket} size="sm" className="text-blue-400 shrink-0" />
                <span className="text-slate-400">Invite code:</span>
                <span className="font-mono text-slate-100 truncate">{code}</span>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Your team name</label>
                <input
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g. Ice Breakers"
                  className="w-full bg-slate-900/80 border border-white/15 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={busy || !teamName.trim()}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors"
              >
                {busy ? 'Joining…' : 'Join league'}
              </button>
            </form>
          ) : (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-400/20 flex items-center justify-center mx-auto mb-3">
                <Icon as={Ticket} size="md" className="text-blue-300" />
              </div>
              <p className="text-slate-200 font-medium">This link has no invite code</p>
              <p className="text-slate-500 text-sm mt-1 mb-5">Ask your commissioner for a fresh invite link, or join with a code instead.</p>
              <Link
                to="/leagues"
                className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"
              >
                Go to My Leagues
              </Link>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
