import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defaultClientConditions, defaultServerConditions, defineConfig } from 'vite';

/** Same variable as the server (`AGENTIC_PORT`, default 8787). The dev server itself listens on `AGENTIC_WEB_PORT`. */
const HOST = '127.0.0.1';
const API_ORIGIN = `http://${HOST}:${process.env['AGENTIC_PORT'] ?? '8787'}`;
const WEB_PORT = Number(process.env['AGENTIC_WEB_PORT'] ?? 5173);

const server = {
  host: HOST,
  port: WEB_PORT,
  /**
   * The API only accepts its own Host and Origin (DNS rebinding and CSRF guards, D19): the proxy presents the
   * API origin for both, so the dev server behaves like the page served by `agentic serve`.
   */
  proxy: { '/api': { changeOrigin: true, headers: { origin: API_ORIGIN }, target: API_ORIGIN } },
  strictPort: true,
};

export default defineConfig({
  /** No `.env` file is ever read: the dev server would inline `VITE_*` values in the code it serves. */
  envDir: false,
  plugins: [tailwindcss(), tanstackStart({ router: { routeFileIgnorePattern: String.raw`\.test\.` }, spa: { enabled: true } }), viteReact()],
  preview: server,
  /** Workspace packages export TypeScript sources under `development`; the production build reads them too. */
  resolve: { conditions: ['development', ...defaultClientConditions], tsconfigPaths: true },
  server,
  ssr: { resolve: { conditions: ['development', ...defaultServerConditions], externalConditions: ['development'] } },
});
