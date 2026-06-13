import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { HeartPulse, RefreshCw } from 'lucide-react';
import { type InjuryReport } from '../services/injuryService';
import { useInjuries } from '../queries/useInjuries';
import { useLeague } from '../context/LeagueContext';
import { db } from '../firebase';
import { GlassCard } from './ui/GlassCard';
import { Badge } from './ui/Badge';
import { GradientButton } from './ui/GradientButton';
import { Icon } from './ui/Icon';
import { SkeletonRow } from './ui/Skeleton';
import { InjuryCard } from './injuries/InjuryCard';
import { nhlTeamLogo } from './injuries/nhlTeamLogo';

interface DraftedPlayer {
  id: string;
  playerId?: number;
  name: string;
  position?: string;
  nhlTeam?: string;
}

const MUG_SEASON = '20242025';

export default function Injuries() {
  const [teamFilter, setTeamFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [myPlayers, setMyPlayers] = useState<DraftedPlayer[]>([]);
  const [myPlayersLoading, setMyPlayersLoading] = useState<boolean>(true);

  // React Query hook - automatic caching and refetching!
  const { data: injuries = [], isLoading: loading, dataUpdatedAt, error, refetch } = useInjuries();
  const { myTeam } = useLeague();

  // Convert dataUpdatedAt timestamp to Date
  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

  // Load my drafted players to highlight their injuries
  useEffect(() => {
    if (!myTeam) {
      setMyPlayers([]);
      setMyPlayersLoading(false);
      return;
    }

    setMyPlayersLoading(true);
    const playersQuery = query(
      collection(db, 'draftedPlayers'),
      where('draftedByTeam', '==', myTeam.teamName),
      orderBy('pickNumber', 'asc')
    );

    const unsubscribe = onSnapshot(
      playersQuery,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => {
          const player = doc.data() as DraftedPlayer & { id?: string };
          const { id, ...rest } = player;
          void id;

          return {
            id: doc.id,
            ...rest,
          };
        });
        setMyPlayers(data);
        setMyPlayersLoading(false);
      },
      (err) => {
        console.error('Error loading my players for injuries:', err);
        setMyPlayers([]);
        setMyPlayersLoading(false);
      }
    );

    return () => unsubscribe();
  }, [myTeam]);

  const normalizeName = (name?: string) => (name || '').toLowerCase().trim();

  const myPlayerByName = useMemo(() => {
    const map = new Map<string, DraftedPlayer>();
    for (const player of myPlayers) map.set(normalizeName(player.name), player);
    return map;
  }, [myPlayers]);

  // My injuries, paired with an NHL headshot resolved from the matched drafted player.
  const myInjuryCards = useMemo(() => {
    if (!myPlayerByName.size) return [];
    return injuries
      .filter((injury) => myPlayerByName.has(normalizeName(injury.playerName)))
      .map((injury) => {
        const player = myPlayerByName.get(normalizeName(injury.playerName));
        const headshotUrl = player?.playerId && player.nhlTeam
          ? `https://assets.nhle.com/mugs/nhl/${MUG_SEASON}/${player.nhlTeam}/${player.playerId}.png`
          : undefined;
        return { injury, headshotUrl };
      });
  }, [injuries, myPlayerByName]);

  // Get unique teams
  const teams = Array.from(new Set(injuries.map(i => i.teamAbbrev))).sort();

  // Filter injuries
  const filteredInjuries = injuries.filter(injury => {
    const matchesTeam = teamFilter === 'ALL' || injury.teamAbbrev === teamFilter;
    const matchesStatus = statusFilter === 'ALL' || injury.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesTeam && matchesStatus;
  });

  // Group by team
  const injuriesByTeam = filteredInjuries.reduce((acc, injury) => {
    if (!acc[injury.teamAbbrev]) {
      acc[injury.teamAbbrev] = [];
    }
    acc[injury.teamAbbrev].push(injury);
    return acc;
  }, {} as Record<string, InjuryReport[]>);

  const selectClass = 'w-full px-4 py-2 rounded-lg bg-slate-900/50 text-white border border-slate-700 focus:border-blue-500 focus:outline-none transition-colors';

  return (
    <div className="max-w-6xl mx-auto">
      {/* Info Banner */}
      <div className="flex items-center gap-2 bg-blue-900/20 border border-blue-500/20 px-4 py-2.5 rounded-lg mb-6 text-sm">
        <Icon as={HeartPulse} size="sm" className="text-blue-300 shrink-0" />
        <span className="text-blue-200">Live injury data from ESPN.</span>
        {lastUpdated && (
          <span className="text-slate-500 text-xs">Updated {lastUpdated.toLocaleTimeString()}</span>
        )}
      </div>

      {/* My Injured Players */}
      <GlassCard className="p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Icon as={HeartPulse} size="md" className="text-pink-400" />
          <div>
            <h3 className="text-2xl font-semibold text-white leading-tight">My Injured Players</h3>
            <p className="text-gray-400 text-sm">Injuries on your fantasy roster.</p>
          </div>
        </div>

        {!myTeam && (
          <p className="text-gray-400">
            Join a league and get assigned to a team to see personalized injury alerts.
          </p>
        )}

        {myTeam && (loading || myPlayersLoading) && (
          <div className="grid md:grid-cols-2 gap-3">
            <SkeletonRow /><SkeletonRow />
          </div>
        )}

        {myTeam && !loading && !myPlayersLoading && myInjuryCards.length === 0 && (
          <div className="bg-green-900/20 border border-green-600/40 p-4 rounded-lg">
            <p className="text-green-300 font-semibold">🎉 No current injuries on {myTeam.teamName}!</p>
            <p className="text-gray-300 text-sm mt-1">Keep an eye here during the season for quick alerts.</p>
          </div>
        )}

        {myTeam && !loading && !myPlayersLoading && myInjuryCards.length > 0 && (
          <div className="grid md:grid-cols-2 gap-3">
            {myInjuryCards.map(({ injury, headshotUrl }) => (
              <InjuryCard key={`${injury.playerId}-${injury.lastUpdated}`} injury={injury} headshotUrl={headshotUrl} />
            ))}
          </div>
        )}
      </GlassCard>

      {/* Filters */}
      <GlassCard className="p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Team Filter */}
          <div className="flex-1">
            <label className="block text-white font-semibold mb-2">Filter by Team:</label>
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className={selectClass}
            >
              <option value="ALL">All Teams ({injuries.length} injuries)</option>
              {teams.map(team => {
                const teamInjuries = injuries.filter(i => i.teamAbbrev === team);
                return (
                  <option key={team} value={team}>
                    {team} ({teamInjuries.length} injuries)
                  </option>
                );
              })}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex-1">
            <label className="block text-white font-semibold mb-2">Filter by Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={selectClass}
            >
              <option value="ALL">All Statuses</option>
              <option value="Out">Out</option>
              <option value="Day-To-Day">Day-To-Day</option>
              <option value="Questionable">Questionable</option>
              <option value="Doubtful">Doubtful</option>
              <option value="Injured Reserve">Injured Reserve</option>
            </select>
          </div>

          {/* Refresh Button */}
          <div className="md:w-auto md:self-end">
            <GradientButton
              onClick={() => refetch()}
              disabled={loading}
              variant="primary"
              className="flex items-center gap-2"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Refreshing...' : 'Refresh Injuries'}
            </GradientButton>
          </div>
        </div>

        {/* Results Count */}
        {!loading && (
          <div className="mt-4 text-gray-400 text-sm">
            Showing {filteredInjuries.length} of {injuries.length} injured players
          </div>
        )}
      </GlassCard>

      {/* Loading State */}
      {loading && (
        <GlassCard className="p-4">
          <div className="grid md:grid-cols-2 gap-3">
            <SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow />
          </div>
        </GlassCard>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-900/40 border border-red-600/50 p-6 rounded-lg shadow-lg mb-8">
          <p className="text-red-200 font-semibold">⚠️ {(error as Error).message}</p>
          <GradientButton
            onClick={() => refetch()}
            variant="danger"
            className="mt-4"
          >
            Try Again
          </GradientButton>
        </div>
      )}

      {/* Injuries List */}
      {!loading && !error && filteredInjuries.length === 0 && (
        <GlassCard className="p-6 text-center">
          <p className="text-gray-400">No injuries found matching your filters. 🎉</p>
        </GlassCard>
      )}

      {!loading && !error && Object.keys(injuriesByTeam).length > 0 && (
        <div className="space-y-6">
          {Object.entries(injuriesByTeam)
            .sort(([teamA], [teamB]) => teamA.localeCompare(teamB))
            .map(([team, teamInjuries]) => (
              <GlassCard key={team} className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <img
                    src={nhlTeamLogo(team)}
                    alt=""
                    aria-hidden
                    className="w-8 h-8 object-contain"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                  <h3 className="text-xl font-semibold text-white">{teamInjuries[0].team}</h3>
                  <Badge variant="outline">{teamInjuries.length} injured</Badge>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  {teamInjuries.map((injury) => (
                    <InjuryCard key={injury.playerId} injury={injury} />
                  ))}
                </div>
              </GlassCard>
            ))}
        </div>
      )}
    </div>
  );
}
