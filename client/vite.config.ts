import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // GitHub Pages serves this project site at /Skak/, so asset URLs need
  // that prefix in production; keep the dev server at the root.
  base: command === 'build' ? '/Skak/' : '/',
  plugins: [react()],
}))
