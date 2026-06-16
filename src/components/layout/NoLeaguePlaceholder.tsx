import { useAuth } from '../../context/AuthContext';

export default function NoLeaguePlaceholder() {
  const { signOut } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-md space-y-4">
        <h1 className="text-2xl font-bold text-white">You're not in a league yet</h1>
        <p className="text-gray-400">
          Ask a league admin to add your account, then reload. Creating and joining leagues
          from here is coming soon.
        </p>
        <button
          onClick={() => signOut()}
          className="bg-transparent hover:bg-white/10 text-gray-400 hover:text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium border border-white/10 hover:border-white/30"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
