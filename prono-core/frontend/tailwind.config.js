/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'wc-gold': 'var(--theme-accent)',
        'wc-green': 'var(--theme-primary)',
        'wc-red': 'var(--theme-danger)',
        'wc-dark': 'var(--theme-dark)',
        'wc-dark-secondary': 'var(--theme-dark-secondary)',
      },
      backgroundImage: {
        'pitch': "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%23006600'/%3E%3Crect x='0' y='0' width='40' height='20' fill='%23007700' opacity='0.5'/%3E%3C/svg%3E\")",
      },
      animation: {
        'bounce-slow': 'bounce 2s infinite',
        'pulse-gold': 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'toast-in': 'toast-in 0.2s ease-out',
      },
      keyframes: {
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      }
    },
  },
  plugins: [],
}
