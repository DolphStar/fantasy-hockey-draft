import { useState, useEffect } from 'react';
import { fetchAllInjuries, getInjuryIcon, getInjuryColor, type InjuryReport } from '../services/injuryService';

export default function Injuries() {
  const [injuries, setInjuries] = useState<InjuryReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teamFilter, setTeamFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadInjuries = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAllInjuries();
      setInjuries(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError('Failed to load injury data from ESPN');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInjuries();
  }, []);

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

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h2 className="text-3xl font-bold mb-6 text-white">🏥 NHL Injury Report</h2>

      {/* Info Banner */}
      <div className="bg-blue-900/30 border border-blue-500/30 p-4 rounded-lg mb-6">
        <p className="text-blue-200 text-sm">
          <strong>🏒 Real-time injury data</strong> from NHL's official API. Player injury status is checked directly from individual player landing pages.
          {lastUpdated && (
            <span className="ml-2 text-gray-400">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </p>
        <p className="text-gray-400 text-xs mt-2">
          Note: Initial load may take 30-60 seconds as we check ~700 NHL players for injury status. Data refreshes every 5 minutes.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-6">
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
            <button
              onClick={loadInjuries}
              disabled={loading}
              className="w-full md:w-auto px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors disabled:bg-gray-600"
            >
              {loading ? '🔄 Loading...' : '🔄 Refresh'}
            </button>
          </div>
        </div>

        {/* Results Count */}
        {!loading && (
          <div className="mt-4 text-gray-400 text-sm">
            Showing {filteredInjuries.length} of {injuries.length} injured players
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-gray-800 p-8 rounded-lg shadow-lg text-center">
          <p className="text-gray-400 text-lg">Loading injury reports from ESPN...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-900/50 border border-red-600 p-6 rounded-lg shadow-lg mb-8">
          <p className="text-red-200 font-semibold">⚠️ {error}</p>
          <button
            onClick={loadInjuries}
            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Injuries List */}
      {!loading && !error && filteredInjuries.length === 0 && (
        <div className="bg-gray-800 p-6 rounded-lg text-center">
          <p className="text-gray-400">No injuries found matching your filters. 🎉</p>
        </div>
      )}

      {!loading && !error && Object.keys(injuriesByTeam).length > 0 && (
        <div className="space-y-6">
          {Object.entries(injuriesByTeam)
            .sort(([teamA], [teamB]) => teamA.localeCompare(teamB))
            .map(([team, teamInjuries]) => (
              <div key={team} className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <h3 className="text-xl font-semibold mb-4 text-white">
                  {team} - {teamInjuries[0].team} ({teamInjuries.length} injured)
                </h3>
                <div className="space-y-3">
                  {teamInjuries.map((injury) => (
                    <div
                      key={injury.playerId}
                      className="bg-gray-700 p-4 rounded-lg hover:bg-gray-650 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="text-white font-semibold text-lg">
                              {injury.playerName}
                            </span>
                            <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded font-bold">
                              {injury.position}
                            </span>
                            <span className={`${getInjuryColor(injury.status)} text-white text-xs px-2 py-1 rounded font-bold flex items-center gap-1`}>
                              {getInjuryIcon(injury.status)} {injury.status.toUpperCase()}
                            </span>
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
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
