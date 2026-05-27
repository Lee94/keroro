import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [solid()],

  resolve: {
    alias: {
      // @xterm/addon-canvas@0.8.0-beta.48 ships with a broken `module`
      // field — package.json points at `lib/addon-canvas.mjs` but the
      // tarball actually contains `lib/xterm-addon-canvas.mjs`. Redirect
      // the bare specifier to the file that exists so Vite can resolve it.
      "@xterm/addon-canvas": "@xterm/addon-canvas/lib/xterm-addon-canvas.mjs",
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
