import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Logo } from './ui/Logo';

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

/**
 * The one full-bleed moment in the product.
 *
 * The nameplate is deliberately the *same* device the player cards use — a small
 * tracked-out line over a huge heavy one — because the cards are the strongest
 * thing in the app and this is the first screen anyone sees. No card, no glass:
 * the type sits directly on the ice.
 */
export default function Login() {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      await signInWithGoogle();
    } catch (err) {
      setError('Failed to sign in. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-16 text-center">
      <Logo className="w-12 h-12 mb-10" />

      <h1 className="flex flex-col items-center leading-none">
        <span className="font-heading text-white/55 font-medium uppercase text-[clamp(0.7rem,2.2vw,1.05rem)] tracking-[0.42em] indent-[0.42em]">
          Fantasy
        </span>
        {/* Two words, not one string: on phones they stack so the nameplate can
            stay big, and on wider screens they sit on one line. The size ramps
            differ across that break because a stacked word is half the width —
            a single clamp that fits one line looks tiny stacked, and one that
            fits stacked overflows the line. */}
        <span
          className="mt-2 flex flex-col items-center sm:flex-row sm:gap-[0.22em]
                     font-heading font-black uppercase text-white
                     text-[clamp(2.75rem,13vw,7.5rem)] sm:text-[clamp(2rem,8vw,7.5rem)]
                     tracking-[0.02em] indent-[0.02em]
                     drop-shadow-[0_6px_14px_rgba(0,0,0,0.75)]"
        >
          <span>Hockey</span>
          <span>Draft</span>
        </span>
      </h1>

      <p className="mt-7 max-w-sm text-slate-400 text-base">
        Draft your roster. Track every night. Win the league.
      </p>

      {error && (
        <div
          className="mt-7 max-w-sm rounded-lg border border-live/30 bg-live/10 px-4 py-3 text-sm text-red-200"
          role="alert"
        >
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={loading}
        className="mt-9 inline-flex items-center justify-center gap-3 rounded-xl bg-white px-7 py-3.5 font-semibold text-slate-900 transition-all hover:bg-slate-100 hover:shadow-[0_0_28px_rgba(255,255,255,.18)] active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paint focus-visible:ring-offset-2 focus-visible:ring-offset-ice-boards"
      >
        {loading ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-slate-900 motion-reduce:animate-none" />
            Signing in…
          </>
        ) : (
          <>
            <GoogleIcon />
            Sign in with Google
          </>
        )}
      </button>

      <p className="mt-10 font-heading text-[10px] uppercase tracking-[0.28em] text-slate-600">
        Need help? Ask your commissioner
      </p>
    </div>
  );
}
