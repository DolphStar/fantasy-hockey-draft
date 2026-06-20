import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { toast } from 'sonner';
import { ArrowLeft, Globe, Plus } from 'lucide-react';

import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useMemberships } from '../../context/MembershipContext';
import { canRequestJoin } from '../../../packages/core/membership/canRequestJoin';
import {
  cancelJoinRequest,
  getMyJoinRequest,
  requestToJoin,
} from '../../services/joinRequestService';
import { GlassCard } from '../ui/GlassCard';
import { GlowBackdrop } from '../ui/GlowBackdrop';
import { Icon } from '../ui/Icon';

interface PublicLeague {
  id: string;
  leagueName: string;
  status: string;
  isPublic: boolean;
  teams: { teamName: string; ownerUid: string }[];
  maxTeams: number;
  requested: boolean;
}

export default function LeaguesBrowse() {
  const { user } = useAuth();
  const { memberships } = useMemberships();
  const [leagues, setLeagues] = useState<PublicLeague[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'leagues'), where('isPublic', '==', true)));
      const mine = new Set(memberships.map((m) => m.id));
      const rows = await Promise.all(
        snap.docs
          .filter((d) => !mine.has(d.id))
          .map(async (d) => {
            const data = d.data() as Omit<PublicLeague, 'id' | 'requested'>;
            const req = await getMyJoinRequest(d.id, user.uid);
            return { id: d.id, ...data, requested: !!req } as PublicLeague;
          }),
      );
      setLeagues(rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, memberships]);

  const handleRequest = async (lg: PublicLeague) => {
    if (!user) return;
    const teamName = window.prompt('Your team name for this league?')?.trim();
    if (!teamName) return;
    setBusyId(lg.id);
    try {
      await requestToJoin(lg.id, user.uid, teamName);
      toast.success('Request sent — the league admin will review it.');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send request');
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (lg: PublicLeague) => {
    if (!user) return;
    setBusyId(lg.id);
    try {
      await cancelJoinRequest(lg.id, user.uid);
      toast.success('Request cancelled.');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen px-5 py-8 max-w-2xl mx-auto">
      <GlowBackdrop />

      <header className="flex items-center justify-between mb-8">
        <Link to="/leagues" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
          <Icon as={ArrowLeft} size="sm" /> My Leagues
        </Link>
      </header>

      <h1 className="text-3xl font-bold text-white mb-1">Browse public leagues</h1>
      <p className="text-slate-400 mb-6">Find an open league and request to join.</p>

      <GlassCard className="p-2">
        {loading ? (
          <p className="text-slate-400 text-sm p-4">Loading…</p>
        ) : leagues.length === 0 ? (
          <div className="text-center px-4 py-12">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-400/20 flex items-center justify-center mx-auto mb-3">
              <Icon as={Globe} size="md" className="text-blue-300" />
            </div>
            <p className="text-slate-200 font-medium">No public leagues right now</p>
            <p className="text-slate-500 text-sm mt-1 mb-5">Be the first — start your own and make it public.</p>
            <Link
              to="/leagues/new"
              className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"
            >
              <Icon as={Plus} size="sm" /> Create a league
            </Link>
          </div>
        ) : (
          leagues.map((lg) => {
            const eligible = canRequestJoin(lg, user?.uid ?? '', lg.requested);
            return (
              <div key={lg.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-600/20 border border-blue-400/20 flex items-center justify-center font-bold text-blue-200 shrink-0">
                  {lg.leagueName.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white truncate">{lg.leagueName}</p>
                  <p className="text-xs text-slate-400">{lg.teams.length}/{lg.maxTeams} teams · {lg.status}</p>
                </div>
                {lg.requested ? (
                  <span className="flex items-center gap-3 text-sm shrink-0">
                    <span className="text-points">Requested ✓</span>
                    <button type="button" disabled={busyId === lg.id} onClick={() => handleCancel(lg)} className="text-slate-400 hover:text-live disabled:opacity-50">Cancel</button>
                  </span>
                ) : eligible ? (
                  <button type="button" disabled={busyId === lg.id} onClick={() => handleRequest(lg)} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors shrink-0">Request to join</button>
                ) : (
                  <span className="text-xs text-slate-500 shrink-0">{lg.status !== 'pending' ? 'Drafting' : 'Full'}</span>
                )}
              </div>
            );
          })
        )}
      </GlassCard>
    </div>
  );
}
