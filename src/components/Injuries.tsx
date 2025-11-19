import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { getInjuryIcon, type InjuryReport } from '../services/injuryService';
import { useInjuries } from '../queries/useInjuries';
import { useLeague } from '../context/LeagueContext';
import { db } from '../firebase';
import { GlassCard } from './ui/GlassCard';
import { Badge } from './ui/Badge';
import { GradientButton } from './ui/GradientButton';

interface DraftedPlayer {
  id: string;
  playerId?: number;
  name: string;
  position?: string;
  nhlTeam?: string;
}

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
          const { id: _ignoredId, ...rest } = doc.data() as DraftedPlayer;
          return {
            id: doc.id,
            ...rest
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

  const myPlayerNameSet = useMemo(() => {
    return new Set(myPlayers.map((player) => normalizeName(player.name)));
  }, [myPlayers]);

  const myInjuries = useMemo(() => {
    if (!myPlayerNameSet.size) return [];
    return injuries.filter((injury) => myPlayerNameSet.has(normalizeName(injury.playerName)));
  }, [injuries, myPlayerNameSet]);

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

  const getInjuryBadgeVariant = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('out') || s.includes('ir') || s.includes('reserve')) return 'danger';
    return 'warning';
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h2 className="text-3xl font-bold mb-6 text-white">🏥 NHL Injury Report</h2>

      {/* Info Banner */}
      <div className="bg-blue-900/30 border border-blue-500/30 p-4 rounded-lg mb-6">
        <p className="text-blue-200 text-sm">
          <strong>🏒 Real-time injury data</strong> from ESPN's NHL injury API. All league injuries fetched in one request!
          {lastUpdated && (
            <span className="ml-2 text-gray-400">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </p>
        <p className="text-gray-400 text-xs mt-2">
          Fast loading (~2 seconds) • Auto-refreshes every 5 minutes • Data sorted by team
        </p>
      </div>

      {/* My Injured Players */}
      <GlassCard className="p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-2xl font-semibold text-white">👥 My Injured Players</h3>
            <p className="text-gray-400 text-sm">
              Highlights injuries for your fantasy roster.
            </p>
          </div>
        </div>

        {!myTeam && (
          <p className="text-gray-400">
            Join a league and get assigned to a team to see personalized injury alerts.
          </p>
        )}

        {myTeam && (loading || myPlayersLoading) && (
          <p className="text-gray-400">Loading your roster and injury data...</p>
        )}

        {myTeam && !loading && !myPlayersLoading && myInjuries.length === 0 && (
          <div className="bg-green-900/30 border border-green-600/40 p-4 rounded-lg">
            <p className="text-green-300 font-semibold">🎉 No current injuries on {myTeam.teamName}!</p>
            <p className="text-gray-300 text-sm mt-1">Keep an eye here during the season for quick alerts.</p>
          </div>
        )}

        {myTeam && !loading && !myPlayersLoading && myInjuries.length > 0 && (
          <div className="space-y-3">
            {myInjuries.map((injury) => (
              <div
                key={`${injury.playerId}-${injury.lastUpdated}`}
                className="bg-gray-700/50 p-4 rounded-lg border border-red-500/30 hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-white font-semibold text-lg">
                        {injury.playerName}
                      </span>
                      <Badge variant="info">
                        {injury.position}
                      </Badge>
                      <Badge variant={getInjuryBadgeVariant(injury.status)} className="flex items-center gap-1">
                        {getInjuryIcon(injury.status)} {injury.status.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-gray-300"><strong>Team:</strong> {injury.team}</p>
                    <p className="text-gray-300"><strong>Injury:</strong> {injury.injuryType}</p>
                    {injury.description && injury.description !== 'No details available' && (
                      <p className="text-gray-400 text-sm mt-1">{injury.description}</p>
                    )}
                    {injury.returnDate && (
                      <p className="text-gray-400 text-sm mt-1">
                        <strong>Expected Return:</strong> {new Date(injury.returnDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
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
              className="w-full px-4 py-2 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none"
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
              className="w-full px-4 py-2 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none"
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
              🔄 {loading ? 'Refreshing...' : 'Refresh Injuries'}
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
        <GlassCard className="p-8 text-center">
          <p className="text-gray-400 text-lg">Loading injury reports from ESPN...</p>
        </GlassCard>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-900/50 border border-red-600 p-6 rounded-lg shadow-lg mb-8">
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
                <h3 className="text-xl font-semibold mb-4 text-white">
                  {team} - {teamInjuries[0].team} ({teamInjuries.length} injured)
                </h3>
                <div className="space-y-3">
                  {teamInjuries.map((injury) => (
                    <div
                      key={injury.playerId}
                      className="bg-gray-700/50 p-4 rounded-lg hover:bg-gray-700 transition-colors border border-gray-600/30"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="text-white font-semibold text-lg">
                              {injury.playerName}
                            </span>
                            <Badge variant="info">
                              {injury.position}
                            </Badge>
                            <Badge variant={getInjuryBadgeVariant(injury.status)} className="flex items-center gap-1">
                              {getInjuryIcon(injury.status)} {injury.status.toUpperCase()}
                            </Badge>
                          </div>
                          <div className="space-y-1">
                            <p className="text-gray-300">
                              <strong>Injury:</strong> {injury.injuryType}
                            </p>
                            {injury.description && injury.description !== 'No details available' && (
                              <p className="text-gray-400 text-sm">
                                {injury.description}
                              </p>
                            )}
                            {injury.returnDate && (
                              <p className="text-gray-400 text-sm">
                                <strong>Expected Return:</strong> {new Date(injury.returnDate).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            ))}
        </div>
      )}
    </div>
  );
}
