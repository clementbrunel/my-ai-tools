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
        'mh-primary': 'var(--theme-primary)',
        'mh-accent': 'var(--theme-accent)',
        'mh-danger': 'var(--theme-danger)',
        'mh-dark': 'var(--theme-dark)',
        'mh-dark-secondary': 'var(--theme-dark-secondary)',
      },
    },
  },
  plugins: [],
}
