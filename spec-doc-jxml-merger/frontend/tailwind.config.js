/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'gl-orange': 'var(--gl-orange)',
        'gl-orange-dark': 'var(--gl-orange-dark)',
        'gl-purple': 'var(--gl-purple)',
        'gl-blue': 'var(--gl-blue)',
        'gl-blue-dark': 'var(--gl-blue-dark)',
        'gl-dark': 'var(--gl-dark)',
        'gl-success': 'var(--gl-success)',
        'gl-danger': 'var(--gl-danger)',
        'gl-warning': 'var(--gl-warning)',
      },
    },
  },
  plugins: [],
}
