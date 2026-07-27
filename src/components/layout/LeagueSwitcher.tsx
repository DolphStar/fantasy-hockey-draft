import { Link, useNavigate, useParams } from 'react-router-dom';

import { useMemberships } from '../../context/MembershipContext';
import { buildLeaguePath } from '../../lib/leaguePaths';
import { Select } from '../ui/Select';

export default function LeagueSwitcher() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const { memberships } = useMemberships();
  const navigate = useNavigate();

  const active = memberships.find((m) => m.id === leagueId);

  const label = (m: { leagueName: string; status: string }) =>
    m.status === 'complete' ? `${m.leagueName} 🏆` : m.leagueName;

  const control =
    memberships.length <= 1 ? (
      <span className="text-sm font-semibold text-slate-300">{active ? label(active) : ''}</span>
    ) : (
      <Select
        tone="flat"
        aria-label="Switch league"
        value={leagueId ?? ''}
        onChange={(e) => navigate(buildLeaguePath(e.target.value))}
        className="w-auto py-2"
      >
        {memberships.map((m) => (
          <option key={m.id} value={m.id}>
            {label(m)}
          </option>
        ))}
      </Select>
    );

  return (
    <div className="flex items-center gap-2">
      {control}
      <Link to="/leagues" className="text-xs text-gray-400 hover:text-white whitespace-nowrap">Manage</Link>
    </div>
  );
}
