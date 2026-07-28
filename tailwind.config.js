/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0f172a', // Slate 900
        surface: '#1e293b',    // Slate 800
        primary: '#3b82f6',    // Blue 500
        secondary: '#8b5cf6',  // Violet 500
        accent: '#f59e0b',     // Amber 500
        success: '#22c55e',    // Green 500
        danger: '#ef4444',     // Red 500
        warning: '#eab308',    // Yellow 500
        info: '#06b6d4',       // Cyan 500
        points: '#4ade80',
        rank: '#facc15',
        live: '#ef4444',
        // Material ramp, derived from the rink rather than from slate. These are
        // surfaces only — they never carry meaning. Interactive stays blue, rank
        // gold, live red, positive-delta green.
        ice: {
          boards: '#06090f', // page ground, the barn in shadow
          deep: '#0b1220',   // resting card
          raise: '#131e33',  // raised card / hover
          seam: '#21324f',   // hairline between surfaces
        },
        // Rink line paint. A material, never a control — used for ambient
        // geometry and live glow so it can't be confused with interactive blue.
        paint: '#4cb4e7',
        card: { from: '#131e33', to: '#0b1220', border: '#21324f' },
      },
      fontFamily: {
        // `font-heading` (expanded) and `font-data` (narrow, tabular) are defined
        // as utilities in index.css — they need font-stretch and
        // font-variant-numeric, which Tailwind 3 can't express here.
        sans: ['Archivo Variable', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        card: '14px',
      },
      boxShadow: {
        // Elevation scale. `flat` sits on the ice, `glass` is the working
        // default, `hero` is reserved for the one thing that matters on a page.
        'flat': 'inset 0 1px 0 rgba(148,180,255,.05)',
        'glass': '0 8px 32px rgba(0,0,0,.45), inset 0 1px 0 rgba(148,180,255,.14)',
        'glass-hover': '0 16px 44px rgba(0,0,0,.55), 0 0 24px rgba(59,130,246,.18), inset 0 1px 0 rgba(148,180,255,.2)',
        'hero': '0 24px 70px rgba(0,0,0,.6), 0 0 40px rgba(76,180,231,.10), inset 0 1px 0 rgba(148,180,255,.22)',
        'glow-gold': '0 0 14px rgba(250,204,21,.35)',
        // Hero depth plus the champion glow in one token. tailwind-merge treats
        // every shadow-* as the same group, so a card that needs both has to
        // ship them together or the second one silently drops the first.
        'hero-gold': '0 24px 70px rgba(0,0,0,.6), 0 0 40px rgba(250,204,21,.18), inset 0 1px 0 rgba(250,204,21,.25)',
      },
      backgroundImage: {
        'card-surface': 'linear-gradient(160deg, #131e33, #0b1220)',
        'app-radial': 'radial-gradient(ellipse at 20% -10%, #131e33 0%, #06090f 55%)',
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'lock-in': 'lockIn 1s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'shimmer': 'shimmer 1.4s linear infinite',
        'live-pulse': 'live-pulse 1.6s ease-in-out infinite',
        'confetti-fall': 'confetti-fall 3s ease-in forwards',
      },
      keyframes: {
        'confetti-fall': {
          '0%': { transform: 'translateY(0) translateX(0) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateY(105vh) translateX(var(--confetti-drift, 0px)) rotate(540deg)', opacity: '0.7' },
        },
        lockIn: {
          '0%': {
            transform: 'scale(0.8)',
            opacity: '0',
            backgroundColor: 'rgba(34, 197, 94, 0.3)',
          },
          '50%': {
            transform: 'scale(1.05)',
            backgroundColor: 'rgba(34, 197, 94, 0.2)',
          },
          '100%': {
            transform: 'scale(1)',
            opacity: '1',
            backgroundColor: 'transparent',
          },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shimmer: {
          from: { backgroundPosition: '200% 0' },
          to: { backgroundPosition: '-200% 0' },
        },
        'live-pulse': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '.5', transform: 'scale(.75)' },
        },
      },
    },
  },
  plugins: [],
}
