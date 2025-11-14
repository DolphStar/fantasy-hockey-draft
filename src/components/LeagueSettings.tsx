import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLeague } from '../context/LeagueContext';
import { useDraft } from '../context/DraftContext';
import TestScoring from './TestScoring';
import TestLiveStats from './TestLiveStats';
import AdminPlayerManagement from './AdminPlayerManagement';
import type { LeagueTeam } from '../types/league';

export default function LeagueSettings() {
  const { user } = useAuth();
  const { league, loading, isAdmin, createLeague, updateLeague, startDraft } = useLeague();
  const { resetDraft, draftState } = useDraft();
  
  const [leagueName, setLeagueName] = useState('');
  const [draftRounds, setDraftRounds] = useState(15);
  const [teams, setTeams] = useState<LeagueTeam[]>([
    { teamName: 'My Team', ownerUid: user?.uid || '', ownerEmail: user?.email || '' },
    { teamName: 'Friend 1', ownerUid: '', ownerEmail: '' },
    { teamName: 'Friend 2', ownerUid: '', ownerEmail: '' },
    { teamName: 'Friend 3', ownerUid: '', ownerEmail: '' },
  ]);
  
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Populate form when league loads
  useEffect(() => {
    if (league) {
      setLeagueName(league.leagueName);
      setDraftRounds(league.draftRounds);
      setTeams(league.teams);
    }
  }, [league]);

  // Update team field
  const updateTeam = (index: number, field: keyof LeagueTeam, value: string) => {
    const newTeams = [...teams];
    newTeams[index] = { ...newTeams[index], [field]: value };
    setTeams(newTeams);
  };

  // Add team
  const addTeam = () => {
    setTeams([...teams, { teamName: `Team ${teams.length + 1}`, ownerUid: '', ownerEmail: '' }]);
  };

  // Remove team
  const removeTeam = (index: number) => {
    if (teams.length <= 2) {
      setError('You need at least 2 teams');
      return;
    }
    setTeams(teams.filter((_, i) => i !== index));
  };

  // Create new league
  const handleCreateLeague = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!leagueName.trim()) {
      setError('Please enter a league name');
      return;
    }

    if (teams.length < 2) {
      setError('You need at least 2 teams');
      return;
    }

    try {
      setCreating(true);
      const leagueId = await createLeague({
        leagueName: leagueName.trim(),
        teams,
        draftRounds,
      });
      setSuccess(`League created! ID: ${leagueId}`);
      setLeagueName('');
    } catch (err) {
      setError('Failed to create league');
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  // Update existing league
  const handleUpdateLeague = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!league) return;

    setError(null);
    setSuccess(null);

    try {
      setCreating(true);
      await updateLeague(league.id, { teams, draftRounds });
      setSuccess('League updated successfully! Remember to reset the draft if you changed rounds.');
    } catch (err) {
      setError('Failed to update league');
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <p className="text-gray-400">Loading league...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-3xl font-bold mb-6 text-white">League Settings</h2>

      {/* Display current league info */}
      {league && (
        <div className="bg-gray-800 p-6 rounded-lg mb-6 border-2 border-blue-500">
          <h3 className="text-xl font-bold text-white mb-2">{league.leagueName}</h3>
          <p className="text-gray-400 text-sm">Status: <span className="text-blue-400 font-semibold">{league.status}</span></p>
          <p className="text-gray-400 text-sm">Teams: {league.teams.length}</p>
          <p className="text-gray-400 text-sm">Draft Rounds: {league.draftRounds}</p>
          {league.draftRounds < 22 && (
            <p className="text-orange-400 text-sm mt-1">
              ⚠️ Warning: {league.draftRounds} rounds is not enough! Each team needs 22 picks to fill roster (9F + 6D + 2G + 5 reserves).
              {isAdmin && ' Update "Draft Rounds" below and reset draft.'}
            </p>
          )}
          {draftState && (
            <p className="text-gray-400 text-sm">
              Draft Progress: Pick {draftState.currentPickNumber} of {draftState.totalPicks}
            </p>
          )}
          {isAdmin && <p className="text-green-400 text-sm mt-2">✓ You are the admin</p>}
        </div>
      )}

      {/* Admin Draft Controls */}
      {league && isAdmin && (
        <div className="bg-gray-800 p-6 rounded-lg mb-6 border-2 border-green-500">
          <h3 className="text-xl font-bold text-white mb-4">🏒 Draft Controls (Admin Only)</h3>
          
          <div className="space-y-3">
            {/* Start Draft Button */}
            {league.status === 'pending' && (
              <button
                onClick={async () => {
                  try {
                    await startDraft(league.id);
                    setSuccess('Draft started! Status changed to Live.');
                  } catch (err) {
                    setError('Failed to start draft');
                  }
                }}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                🚀 Start Draft (Change to Live)
              </button>
            )}

            {/* Reset Draft Button */}
            <button
              onClick={async () => {
                if (confirm('Are you sure you want to reset the draft? This will clear all picks and start over.')) {
                  try {
                    await resetDraft();
                    setSuccess('Draft reset successfully! All picks cleared.');
                  } catch (err) {
                    setError('Failed to reset draft');
                  }
                }
              }}
              className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              🔄 Reset Draft (Clear All Picks)
            </button>

            {draftState && (
              <div className="bg-gray-700 p-4 rounded-lg">
                <p className="text-white text-sm">
                  <strong>Current Pick:</strong> #{draftState.currentPickNumber} (Round {Math.ceil(draftState.currentPickNumber / league.teams.length)})
                </p>
                <p className="text-gray-300 text-sm mt-1">
                  Total Picks: {draftState.totalPicks} ({league.teams.length} teams × {league.draftRounds} rounds)
                </p>
                <p className="text-gray-300 text-sm">
                  Complete: {draftState.isComplete ? 'Yes ✓' : 'No'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Show form if no league exists or if user is admin */}
      {(!league || isAdmin) && (
        <form onSubmit={league ? handleUpdateLeague : handleCreateLeague} className="bg-gray-800 p-6 rounded-lg shadow-lg">
          <h3 className="text-xl font-semibold mb-4 text-white">
            {league ? 'Update League' : 'Create New League'}
          </h3>

          {error && (
            <div className="bg-red-900/50 border border-red-600 p-4 rounded-lg mb-4">
              <p className="text-red-200">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-900/50 border border-green-600 p-4 rounded-lg mb-4">
              <p className="text-green-200">{success}</p>
            </div>
          )}

          {!league && (
            <>
              {/* League Name */}
              <div className="mb-4">
                <label className="block text-white font-semibold mb-2">League Name</label>
                <input
                  type="text"
                  value={leagueName}
                  onChange={(e) => setLeagueName(e.target.value)}
                  placeholder="e.g., My Hockey League"
                  className="w-full px-4 py-2 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>

              {/* Draft Rounds */}
              <div className="mb-6">
                <label className="block text-white font-semibold mb-2">Draft Rounds</label>
                <input
                  type="number"
                  value={draftRounds}
                  onChange={(e) => setDraftRounds(parseInt(e.target.value))}
                  min="1"
                  max="30"
                  className="w-full px-4 py-2 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
                <p className="text-sm text-gray-400 mt-1">
                  💡 Recommended: <span className="text-yellow-400 font-semibold">22 rounds</span>
                  {' '}(9F + 6D + 2G + 5 reserves = 22 players per team)
                </p>
                {draftRounds < 22 && (
                  <p className="text-sm text-orange-400 mt-1">
                    ⚠️ Warning: {draftRounds} rounds × {teams.length} teams = {draftRounds * teams.length} total picks. 
                    Each team only gets {draftRounds} picks but needs 22 to fill roster!
                  </p>
                )}
              </div>
            </>
          )}

          {/* Teams */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <label className="block text-white font-semibold">Teams ({teams.length})</label>
              <button
                type="button"
                onClick={addTeam}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
              >
                + Add Team
              </button>
            </div>

            <div className="space-y-3">
              {teams.map((team, index) => (
                <div key={index} className="bg-gray-700 p-4 rounded-lg border border-gray-600">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-white font-semibold">Team {index + 1}</h4>
                    {index > 0 && (
                      <button
                        type="button"
                        onClick={() => removeTeam(index)}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">Team Name</label>
                      <input
                        type="text"
                        value={team.teamName}
                        onChange={(e) => updateTeam(index, 'teamName', e.target.value)}
                        placeholder="Team Name"
                        className="w-full px-3 py-2 rounded bg-gray-600 text-white border border-gray-500 focus:border-blue-500 focus:outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-gray-400 text-sm mb-1">
                        Owner UID {index === 0 && '(Your UID)'}
                      </label>
                      <input
                        type="text"
                        value={team.ownerUid}
                        onChange={(e) => updateTeam(index, 'ownerUid', e.target.value)}
                        placeholder={index === 0 ? user?.uid : "Friend's Firebase UID"}
                        className="w-full px-3 py-2 rounded bg-gray-600 text-white border border-gray-500 focus:border-blue-500 focus:outline-none font-mono text-sm"
                        disabled={index === 0}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-gray-400 text-sm mb-1">
                        Email (Optional - for reference)
                      </label>
                      <input
                        type="email"
                        value={team.ownerEmail}
                        onChange={(e) => updateTeam(index, 'ownerEmail', e.target.value)}
                        placeholder="friend@example.com"
                        className="w-full px-3 py-2 rounded bg-gray-600 text-white border border-gray-500 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-blue-900/30 border border-blue-600 p-4 rounded-lg mb-6">
            <h4 className="text-blue-300 font-semibold mb-2">📋 How to get Friend UIDs:</h4>
            <ol className="text-blue-200 text-sm space-y-1 list-decimal list-inside">
              <li>Have your friends sign in to the app</li>
              <li>They can find their UID in the browser console (F12)</li>
              <li>Or check Firebase Console → Authentication → Users tab</li>
              <li>Copy their UID and paste it above</li>
            </ol>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={creating}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            {creating ? 'Saving...' : league ? 'Update League' : 'Create League'}
          </button>
        </form>
      )}

      {/* Non-admin view */}
      {league && !isAdmin && (
        <div className="bg-gray-800 p-6 rounded-lg">
          <p className="text-gray-400">Only the league admin can modify settings.</p>
        </div>
      )}

      {/* User UID Display */}
      <div className="mt-6 bg-gray-800 p-4 rounded-lg border border-gray-600">
        <h4 className="text-white font-semibold mb-2">Your Firebase UID:</h4>
        <code className="text-blue-400 bg-gray-900 px-3 py-2 rounded block font-mono text-sm break-all">
          {user?.uid}
        </code>
        <p className="text-gray-400 text-sm mt-2">Share this with your league admin</p>
      </div>

      {/* Admin Tools */}
      {isAdmin && (
        <>
          <div className="mt-6"><TestScoring /></div>
          <div className="mt-6"><TestLiveStats /></div>
          <div className="mt-6"><AdminPlayerManagement /></div>
        </>
      )}
    </div>
  );
}
