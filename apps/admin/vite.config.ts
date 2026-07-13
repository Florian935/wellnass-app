import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Config Vite de l'app admin (SPA React). Le monorepo consomme
// `@wellness/shared` en source TS (workspace npm) — aucune étape de build requise.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
