import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only the framework-independent logic (the API client and the date helpers)
    // is unit-tested; there is no jsdom/Testing Library stack, so component
    // rendering is deliberately out of scope here.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': import.meta.dirname },
  },
});
