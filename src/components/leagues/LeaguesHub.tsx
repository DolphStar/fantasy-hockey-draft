import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { LogOut, Plus, Search, Ticket, Trophy, Users } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { useMemberships } from '../../context/MembershipContext';
import { joinLeagueByCode, leaveLeague } from '../../services/membershipService';
import { fetchLeagueLeaders, type LeagueLeader } from '../../services/leagueService';
import { buildLeaguePath } from '../../lib/leaguePaths';
import { accentAlpha, managerAccent, managerAccentAt } from '../../lib/managerColors';

/** Status is the first thing you want off this screen: is anything happening? */
const LEAGUE_STATE: Record<'pending' | 'live' | 'complete', { label: string; cls: string }> = {
  pending: { label: 'Drafting', cls: 'border-paint/40 text-paint' },
  live: { label: 'Live', cls: 'border-live/40 text-live' },
  complete: { label: 'Season over', cls: 'border-rank/40 text-rank' },
};
import { GlassCard } from '../ui/GlassCard';
import { GlowBackdrop } from '../ui/GlowBackdrop';
import { Logo } from '../ui/Logo';
import { Icon } from '../ui/Icon';

export default function LeaguesHub() {
  const { user, signOut } = useAuth();
  const { memberships, loading, refresh } = useMemberships();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [busy, setBusy] = useState(false);
  const [leaders, setLeaders] = useState<Record<string, LeagueLeader | null>>({});

  // Standings live in a subcollection, so they cost one small read per league.
  // Cards render immediately and the leader fills in when it arrives.
  const membershipIds = memberships.map((m) => m.id).join(',');
  useEffect(() => {
    const ids = membershipIds ? membershipIds.split(',') : [];
    if (!ids.length) {
      setLeaders({});
      return;
    }
    let cancelled = false;
    fetchLeagueLeaders(ids).then((result) => {
      if (!cancelled) setLeaders(result);
    });
    return () => { cancelled = true; };
  }, [membershipIds]);

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

  const inputCls =
    'w-full bg-slate-900/80 border border-white/15 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-colors';

  return (
    <div className="min-h-screen px-5 py-8 max-w-2xl mx-auto">
      <GlowBackdrop />

      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2.5">
          <Logo className="w-9 h-9" />
          <span className="font-heading font-bold text-white text-lg hidden sm:inline">Fantasy Hockey Draft</span>
        </div>
        <button
          type="button"
          onClick={() => signOut()}
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white border border-white/10 hover:border-white/30 rounded-lg px-3 py-1.5 transition-colors"
        >
          <Icon as={LogOut} size="sm" /> Sign Out
        </button>
      </header>

      <h1 className="text-3xl font-bold text-white mb-1">My Leagues</h1>
      <p className="text-slate-400 mb-6">Jump back into a league, or join and create new ones.</p>

      <div className="space-y-5">
        <GlassCard className="p-2">
          {loading ? (
            <p className="text-slate-400 text-sm p-4">Loading…</p>
          ) : memberships.length === 0 ? (
            <div className="text-center px-4 py-10">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-400/20 flex items-center justify-center mx-auto mb-3">
                <Icon as={Trophy} size="md" className="text-blue-300" />
              </div>
              <p className="text-slate-200 font-medium">No leagues yet</p>
              <p className="text-slate-500 text-sm mt-1">Create one or join with an invite code below.</p>
            </div>
          ) : (
            memberships.map((m) => {
              const myTeam = m.teams.find((t) => t.ownerUid === user?.uid);
              const myAccent = managerAccent(m.teams, myTeam?.teamName);
              const leader = leaders[m.id];
              const state = LEAGUE_STATE[m.status];

              return (
                <div key={m.id} className="rounded-xl hover:bg-white/5 transition-colors">
                  <Link to={buildLeaguePath(m.id)} className="block p-3.5">
                    <div className="flex items-start gap-3.5">
                      {/* Your colour in this league, so the card is recognisably yours */}
                      <div
                        className="w-11 h-11 rounded-lg border flex items-center justify-center font-heading font-bold shrink-0"
                        style={{
                          backgroundColor: accentAlpha(myAccent, 0.15),
                          borderColor: accentAlpha(myAccent, 0.45),
                          color: myAccent,
                        }}
                      >
                        {(myTeam?.teamName ?? m.leagueName).slice(0, 2).toUpperCase()}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-heading font-bold text-white uppercase tracking-[0.04em] truncate">
                            {m.leagueName}
                          </span>
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${state.cls}`}>
                            {m.status === 'live' && (
                              <span className="w-1.5 h-1.5 rounded-full bg-current animate-live-pulse motion-reduce:animate-none" />
                            )}
                            {state.label}
                          </span>
                          {m.admin === user?.uid && (
                            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Commissioner</span>
                          )}
                        </div>

                        <p className="text-sm text-slate-400 mt-1 truncate">
                          {myTeam ? <>You manage <span className="text-slate-200 font-semibold">{myTeam.teamName}</span></> : 'No team assigned yet'}
                        </p>

                        <div className="flex items-center gap-4 mt-2.5 text-xs">
                          <span className="inline-flex items-center gap-1.5 text-slate-500">
                            <Icon as={Users} size="sm" />
                            <span className="font-data">{m.teams.length}/{m.maxTeams}</span>
                          </span>
                          {leader && (
                            <span className="inline-flex items-center gap-1.5 min-w-0">
                              <Icon as={Trophy} size="sm" className="text-rank shrink-0" />
                              <span className="text-slate-400 truncate">{leader.teamName}</span>
                              <span className="font-data font-bold text-slate-300">{leader.totalPoints.toFixed(1)}</span>
                            </span>
                          )}
                        </div>

                        {/* Who else is in, in their own colours */}
                        {m.teams.length > 1 && (
                          <div className="flex items-center gap-1 mt-2.5" aria-hidden>
                            {m.teams.map((t, i) => (
                              <span
                                key={t.teamName}
                                title={t.teamName}
                                className="h-1.5 flex-1 max-w-[2.5rem] rounded-full"
                                style={{ backgroundColor: managerAccentAt(i) }}
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={busy}
                        onClick={(e) => { e.preventDefault(); handleLeave(m.id); }}
                        className="text-xs text-slate-600 hover:text-live px-2 py-1 transition-colors shrink-0 disabled:opacity-50"
                      >
                        Leave
                      </button>
                    </div>
                  </Link>
                </div>
              );
            })
          )}
        </GlassCard>

        <GlassCard className="p-5 space-y-3">
          <h2 className="font-heading font-bold text-white flex items-center gap-2">
            <Icon as={Ticket} size="sm" className="text-blue-400" /> Join a league
          </h2>
          <form onSubmit={handleJoin} className="space-y-2.5">
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Invite code" className={inputCls} />
            <input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Your team name" className={inputCls} />
            <button
              type="submit"
              disabled={busy || !code.trim() || !teamName.trim()}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors"
            >
              Join league
            </button>
          </form>
          <Link to="/leagues/browse" className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300">
            <Icon as={Search} size="sm" /> Browse public leagues
          </Link>
        </GlassCard>

        <GlassCard className="p-5">
          <h2 className="font-heading font-bold text-white mb-1 flex items-center gap-2">
            <Icon as={Plus} size="sm" className="text-blue-400" /> Create a league
          </h2>
          <p className="text-slate-400 text-sm mb-4">Start a new league and invite others with a code.</p>
          <Link
            to="/leagues/new"
            className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"
          >
            <Icon as={Plus} size="sm" /> Create league
          </Link>
        </GlassCard>
      </div>
    </div>
  );
}
