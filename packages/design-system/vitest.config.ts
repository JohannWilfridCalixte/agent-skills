import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [viteReact()],
  test: {
    /** `tokens.test.ts` reads `styles.css?raw`; Vitest empties CSS it does not process. */
    css: { include: [/styles\.css/] },
    environment: 'happy-dom',
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    setupFiles: ['src/test/setup.ts'],
  },
});
