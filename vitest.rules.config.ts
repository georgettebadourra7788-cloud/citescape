import { defineConfig } from 'vitest/config'

// Separate from vite.config.ts's `test.include` (which is scoped to src/
// only) so `npm run test:rules` can discover tests/firestore.rules.test.ts
// without pulling it into the plain `npm test` run — see that file's
// top-of-file comment for why it needs a running emulator.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
})
