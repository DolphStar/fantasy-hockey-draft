import { NHL_TEAMS } from '../../utils/nhlApi';

interface RosterFiltersProps {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    positionFilter: string;
    setPositionFilter: (position: string) => void;
    teamFilter: string;
    setTeamFilter: (team: string) => void;
    loading: boolean;
    totalCount: number;
    filteredCount: number;
}

export default function RosterFilters({
    searchQuery,
    setSearchQuery,
    positionFilter,
    setPositionFilter,
    teamFilter,
    setTeamFilter,
    loading,
    totalCount,
    filteredCount
}: RosterFiltersProps) {
    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8">
            <div className="flex flex-col md:flex-row gap-4">
                {/* Search Input */}
                <div className="flex-1">
                    <label className="block text-white font-semibold mb-2">🔍 Search Players:</label>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by name..."
                        className="w-full px-4 py-3 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none"
                    />
                </div>

                {/* Position Filter */}
                <div className="md:w-48">
                    <label className="block text-white font-semibold mb-2">Position:</label>
                    <select
                        value={positionFilter}
                        onChange={(e) => setPositionFilter(e.target.value)}
                        className="w-full px-4 py-3 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none"
                    >
                        <option value="ALL">All Positions</option>
                        <option value="F">Forwards (C/L/R)</option>
                        <option value="C">Center (C)</option>
                        <option value="L">Left Wing (L)</option>
                        <option value="R">Right Wing (R)</option>
                        <option value="D">Defense (D)</option>
                        <option value="G">Goalie (G)</option>
                    </select>
                </div>

                {/* Team Filter */}
                <div className="md:w-48">
                    <label className="block text-white font-semibold mb-2">NHL Team:</label>
                    <select
                        value={teamFilter}
                        onChange={(e) => setTeamFilter(e.target.value)}
                        className="w-full px-4 py-3 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none"
                    >
                        <option value="ALL">All Teams</option>
                        {Object.entries(NHL_TEAMS).map(([abbrev, name]) => (
                            <option key={abbrev} value={abbrev}>
                                {abbrev} - {name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Clear Button */}
                {(searchQuery || positionFilter !== 'ALL' || teamFilter !== 'ALL') && (
                    <div className="md:w-auto md:self-end">
                        <button
                            onClick={() => {
                                setSearchQuery('');
                                setPositionFilter('ALL');
                                setTeamFilter('ALL');
                            }}
                            className="w-full md:w-auto px-4 py-3 rounded bg-red-600 hover:bg-red-700 text-white font-medium transition-colors"
                        >
                            Clear Filters
                        </button>
                    </div>
                )}
            </div>

            {/* Results Count */}
            {!loading && totalCount > 0 && (
                <div className="mt-4 text-gray-400 text-sm">
                    Showing {filteredCount} of {totalCount} players
                    {searchQuery && <span className="ml-1">matching "{searchQuery}"</span>}
                    {positionFilter !== 'ALL' && <span className="ml-1">• Position: {positionFilter === 'F' ? 'Forwards' : positionFilter}</span>}
                    {teamFilter !== 'ALL' && <span className="ml-1">• Team: {teamFilter}</span>}
                </div>
            )}
        </div>
    );
}
