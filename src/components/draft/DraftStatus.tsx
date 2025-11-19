interface DraftStatusProps {
    draftState: any;
    currentPick: any;
    isMyTurn: boolean;
    myTeam: any;
    league: any;
    myTeamPositions: {
        active: { F: number; D: number; G: number };
        reserve: number;
        total: number;
    };
}

export default function DraftStatus({
    draftState,
    currentPick,
    isMyTurn,
    myTeam,
    league,
    myTeamPositions
}: DraftStatusProps) {
    if (!draftState || !currentPick) return null;

    return (
        <div className={`p-4 rounded-lg mb-6 ${isMyTurn ? 'bg-green-900 border-2 border-green-500' : 'bg-gray-800 border-2 border-gray-600'
            }`}>
            <div className="flex items-center justify-between">
                <div className="flex-1">
                    <p className="text-sm text-gray-400">
                        Pick {currentPick.pick} of {draftState.totalPicks} • Round {currentPick.round}
                        {myTeam && <span className="ml-2">• You are: <span className="text-blue-400">{myTeam.teamName}</span></span>}
                    </p>
                    <p className="text-xl font-bold text-white mt-1">
                        {isMyTurn ? (
                            <span className="text-green-400">🏒 YOUR TURN! Draft a player below</span>
                        ) : (
                            <span>Waiting for <span className="text-yellow-400">{currentPick.team}</span></span>
                        )}
                    </p>
                    {myTeam && league?.rosterSettings && (
                        <div className="mt-2 flex gap-4 text-sm">
                            <span className={myTeamPositions.active.F >= league.rosterSettings.forwards ? 'text-green-400' : 'text-gray-400'}>
                                F: {myTeamPositions.active.F}/{league.rosterSettings.forwards}
                            </span>
                            <span className={myTeamPositions.active.D >= league.rosterSettings.defensemen ? 'text-green-400' : 'text-gray-400'}>
                                D: {myTeamPositions.active.D}/{league.rosterSettings.defensemen}
                            </span>
                            <span className={myTeamPositions.active.G >= league.rosterSettings.goalies ? 'text-green-400' : 'text-gray-400'}>
                                G: {myTeamPositions.active.G}/{league.rosterSettings.goalies}
                            </span>
                            <span className="text-purple-400">
                                Reserves: {myTeamPositions.reserve}/5
                            </span>
                            <span className="text-gray-500">
                                ({myTeamPositions.total} total)
                            </span>
                        </div>
                    )}
                </div>
                {isMyTurn && (
                    <div className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold animate-pulse">
                        ON THE CLOCK
                    </div>
                )}
            </div>
        </div>
    );
}
