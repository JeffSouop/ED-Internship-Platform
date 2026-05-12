// Ce preset Vite regroupe déjà TanStack Start et les plugins ci-dessous — ne pas les dupliquer sous peine de casser le build :
// tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build), componentTagger (dev),
// injection VITE_*, alias @, dédup React/TanStack, journaux d’erreur, détection sandbox (port/host/strictPort).
// Config locale : defineConfig({ vite: { ... } }).
// Import en namespace : évite l’erreur Node « Named export 'defineConfig' not found » sur le build CJS du paquet.
import * as TanstackStartPreset from "@lovable.dev/vite-tanstack-config";

const { defineConfig } = TanstackStartPreset;

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    server: {
      // Même principe que Docker : le navigateur ne tape que le front ; /api va au backend unique.
      proxy: {
        "/api": {
          target: "http://localhost:4000",
          changeOrigin: true,
        },
      },
    },
  },
});
