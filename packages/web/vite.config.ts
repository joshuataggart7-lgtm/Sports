import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Room OS",
        short_name: "Room",
        description: "One button turns the entire room into the perfect environment for whatever you are about to do.",
        theme_color: "#0b0d12",
        background_color: "#0b0d12",
        display: "standalone",
        orientation: "any",
        icons: [{ src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
      },
      // Display pages on the TVs must always load the newest build: never serve them from the
      // service worker's cached index, so a pull on the Mac shows up on the next page push.
      workbox: { navigateFallbackDenylist: [/^\/api/, /^\/ws/, /^\/display/], skipWaiting: true, clientsClaim: true },
    }),
  ],
  server: {
    proxy: {
      "/api": "http://localhost:8790",
      "/ws": { target: "ws://localhost:8790", ws: true },
    },
  },
});
