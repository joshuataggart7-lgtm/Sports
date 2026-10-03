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
      workbox: { navigateFallbackDenylist: [/^\/api/, /^\/ws/] },
    }),
  ],
  server: {
    proxy: {
      "/api": "http://localhost:8790",
      "/ws": { target: "ws://localhost:8790", ws: true },
    },
  },
});
