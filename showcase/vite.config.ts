import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' keeps the build host-agnostic (GitHub Pages sub-path, root domain…)
export default defineConfig({ base: './', plugins: [react()] })
