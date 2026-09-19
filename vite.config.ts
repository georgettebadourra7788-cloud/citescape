import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    // Firestore rules tests (tests/firestore.rules.test.ts) need a running
    // emulator and are run separately via `npm run test:rules` (which
    // passes that file explicitly) — scoping discovery to src/ keeps them
    // out of the plain `npm test` so a missing emulator never breaks the
    // regular build/test loop.
    include: ['src/**/*.{test,spec}.ts'],
  },
})
