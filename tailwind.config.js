/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'lock-in': 'lockIn 1s ease-out',
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
      },
    },
  },
  plugins: [],
}
