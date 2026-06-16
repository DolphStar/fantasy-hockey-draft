import { useNavigate, useParams } from 'react-router-dom';

import { useMemberships } from '../../context/MembershipContext';
import { buildLeaguePath } from '../../lib/leaguePaths';

export default function LeagueSwitcher() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const { memberships } = useMemberships();
  const navigate = useNavigate();

  const active = memberships.find((m) => m.id === leagueId);

  if (memberships.length <= 1) {
    return <span className="text-sm font-semibold text-slate-300">{active?.leagueName ?? ''}</span>;
  }

  return (
    <select
      aria-label="Switch league"
      value={leagueId ?? ''}
      onChange={(e) => navigate(buildLeaguePath(e.target.value))}
      className="bg-slate-900/80 border border-white/15 text-sm font-semibold text-slate-200 rounded-lg px-3 py-2 hover:border-white/30 focus:outline-none focus:border-blue-500/50"
    >
      {memberships.map((m) => (
        <option key={m.id} value={m.id}>
          {m.leagueName}
        </option>
      ))}
    </select>
  );
}
