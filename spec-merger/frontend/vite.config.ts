import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// VITE_BASE: deployment sub-path, defaults to "/". Slashes are optional ("spec-merger" or
// "/spec-merger/"): Git Bash rewrites arguments that start with "/" into Windows paths,
// so callers can pass it without the leading slash.
const toBase = (value?: string) => {
  const path = (value ?? '').split('/').filter(Boolean).join('/')
  return path ? `/${path}/` : '/'
}

export default defineConfig(({ mode }) => ({
  base: toBase(loadEnv(mode, '.', 'VITE_').VITE_BASE),
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:8091',
        changeOrigin: true,
      },
    },
  },
}))
