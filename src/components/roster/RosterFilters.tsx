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
    const hasActiveFilters = searchQuery || positionFilter !== 'ALL' || teamFilter !== 'ALL';

    return (
        <div className="relative mb-8">
            {/* Glassmorphism container */}
            <div className="relative bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
                {/* Subtle glow effect */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-cyan-500/5 to-transparent pointer-events-none" />
                
                <div className="relative z-10 flex flex-col lg:flex-row gap-6">
                    {/* Search Input - Takes more space */}
                    <div className="flex-1 min-w-0">
                        <label className="block text-slate-300 text-sm font-medium mb-2 tracking-wide">
                            Search Players
                        </label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <svg className="w-5 h-5 text-slate-500 group-focus-within:text-cyan-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by name..."
                                className="w-full pl-12 pr-4 py-3 rounded-xl bg-slate-800/80 text-white placeholder-slate-500 border border-slate-600/50 focus:border-cyan-500/70 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none transition-all duration-200"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-white transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Filters Row */}
                    <div className="flex flex-col sm:flex-row gap-4">
                        {/* Position Filter */}
                        <div className="sm:w-44">
                            <label className="block text-slate-300 text-sm font-medium mb-2 tracking-wide">
                                Position
                            </label>
                            <div className="relative">
                                <select
                                    value={positionFilter}
                                    onChange={(e) => setPositionFilter(e.target.value)}
                                    className="w-full appearance-none px-4 py-3 pr-10 rounded-xl bg-slate-800/80 text-white border border-slate-600/50 focus:border-cyan-500/70 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none transition-all duration-200 cursor-pointer"
                                >
                                    <option value="ALL">All Positions</option>
                                    <option value="F">Forwards</option>
                                    <option value="C">Center</option>
                                    <option value="L">Left Wing</option>
                                    <option value="R">Right Wing</option>
                                    <option value="D">Defense</option>
                                    <option value="G">Goalie</option>
                                </select>
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        {/* Team Filter */}
                        <div className="sm:w-44">
                            <label className="block text-slate-300 text-sm font-medium mb-2 tracking-wide">
                                NHL Team
                            </label>
                            <div className="relative">
                                <select
                                    value={teamFilter}
                                    onChange={(e) => setTeamFilter(e.target.value)}
                                    className="w-full appearance-none px-4 py-3 pr-10 rounded-xl bg-slate-800/80 text-white border border-slate-600/50 focus:border-cyan-500/70 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none transition-all duration-200 cursor-pointer"
                                >
                                    <option value="ALL">All Teams</option>
                                    {Object.entries(NHL_TEAMS).map(([abbrev, name]) => (
                                        <option key={abbrev} value={abbrev}>
                                            {abbrev} - {name}
                                        </option>
                                    ))}
                                </select>
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        {/* Clear Button */}
                        {hasActiveFilters && (
                            <div className="sm:self-end">
                                <button
                                    onClick={() => {
                                        setSearchQuery('');
                                        setPositionFilter('ALL');
                                        setTeamFilter('ALL');
                                    }}
                                    className="w-full sm:w-auto px-4 py-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 font-medium border border-red-500/30 hover:border-red-500/50 transition-all duration-200"
                                >
                                    Clear
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Results Count - Refined styling */}
                {!loading && totalCount > 0 && (
                    <div className="relative z-10 mt-4 pt-4 border-t border-slate-700/50">
                        <div className="flex items-center gap-2 text-sm">
                            <span className="text-slate-500">Showing</span>
                            <span className="text-cyan-400 font-mono font-semibold">{filteredCount}</span>
                            <span className="text-slate-500">of</span>
                            <span className="text-slate-300 font-mono">{totalCount}</span>
                            <span className="text-slate-500">players</span>
                            
                            {hasActiveFilters && (
                                <div className="flex items-center gap-2 ml-2">
                                    <span className="text-slate-600">•</span>
                                    {searchQuery && (
                                        <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 text-xs border border-cyan-500/20">
                                            "{searchQuery}"
                                        </span>
                                    )}
                                    {positionFilter !== 'ALL' && (
                                        <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 text-xs border border-blue-500/20">
                                            {positionFilter === 'F' ? 'Forwards' : positionFilter}
                                        </span>
                                    )}
                                    {teamFilter !== 'ALL' && (
                                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-xs border border-emerald-500/20">
                                            {teamFilter}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
