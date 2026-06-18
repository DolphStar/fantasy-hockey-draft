import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { toast } from 'sonner';

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
    <div className="min-h-screen py-10 px-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Browse public leagues</h1>
        <Link to="/leagues" className="text-sm text-blue-400 hover:text-blue-300">← My Leagues</Link>
      </div>

      <GlassCard className="p-4 space-y-2">
        {loading ? (
          <p className="text-gray-400 text-sm">Loading…</p>
        ) : leagues.length === 0 ? (
          <p className="text-gray-400 text-sm">No public leagues to join right now.</p>
        ) : (
          leagues.map((lg) => {
            const eligible = canRequestJoin(lg, user?.uid ?? '', lg.requested);
            return (
              <div key={lg.id} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                <div>
                  <p className="font-semibold text-white">{lg.leagueName}</p>
                  <p className="text-xs text-gray-400">{lg.teams.length}/{lg.maxTeams} teams · {lg.status}</p>
                </div>
                {lg.requested ? (
                  <span className="flex items-center gap-3 text-sm">
                    <span className="text-gray-400">Requested ✓</span>
                    <button type="button" disabled={busyId === lg.id} onClick={() => handleCancel(lg)} className="text-gray-400 hover:text-live">Cancel</button>
                  </span>
                ) : eligible ? (
                  <button type="button" disabled={busyId === lg.id} onClick={() => handleRequest(lg)} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg px-3 py-1.5 text-sm font-semibold">Request to join</button>
                ) : (
                  <span className="text-xs text-gray-500">{lg.status !== 'pending' ? 'Drafting' : 'Full'}</span>
                )}
              </div>
            );
          })
        )}
      </GlassCard>
    </div>
  );
}
