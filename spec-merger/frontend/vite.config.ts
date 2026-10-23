import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// VITE_BASE: deployment sub-path, defaults to "/". Slashes are optional ("spec-merger" or
// "/spec-merger/"): Git Bash rewrites arguments that start with "/" into Windows paths,
// so callers can pass it without the leading slash.
const toBase = (value?: string) => {
  const path = (value ?? '').split('/').filter(Boolean).join('/')
  return path ? `/${path}/` : '/'
}

// VITE_ALLOWED_HOSTS: comma-separated hosts allowed to reach the dev server (empty = Vite default).
const toHosts = (value?: string) =>
  (value ?? '').split(',').map((host) => host.trim()).filter(Boolean)

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_')
  return {
    base: toBase(env.VITE_BASE),
    plugins: [react()],
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/setupTests.ts'],
    },
    server: {
      port: 5174,
      // Listen on all interfaces only when extra hosts are allowed; Vite defaults to localhost only,
      // which makes any other host name fail with ERR_CONNECTION_REFUSED.
      host: toHosts(env.VITE_ALLOWED_HOSTS).length > 0,
      proxy: {
        '/api': {
          target: 'http://localhost:8091',
          changeOrigin: true,
        },
      },
      allowedHosts: toHosts(env.VITE_ALLOWED_HOSTS),
    },
  }
})
