import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import electron from "vite-plugin-electron/simple";
import { grubApiPlugin } from "./src/server/grubVitePlugin";

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [
    react(),
    tailwindcss(),
    grubApiPlugin(),
    electron({
      main: {
        entry: "src/electron/main.ts",
      },
      preload: {
        input: "src/electron/preload.ts",
      },
    }),
  ],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: false,
  },
}));
