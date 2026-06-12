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
        card: { from: '#101729', to: '#0d1322', border: '#1e293b' },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        heading: ['Outfit', 'sans-serif'],
      },
      borderRadius: {
        card: '14px',
      },
      backgroundImage: {
        'card-surface': 'linear-gradient(160deg, #101729, #0d1322)',
        'app-radial': 'radial-gradient(ellipse at 20% -10%, #131b33 0%, #0a0e1a 55%)',
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'lock-in': 'lockIn 1s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
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
      },
    },
  },
  plugins: [],
}
