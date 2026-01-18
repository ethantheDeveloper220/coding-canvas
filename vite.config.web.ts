import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { resolve } from "path"
import tailwindcss from "tailwindcss"
import autoprefixer from "autoprefixer"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src/renderer"),
    },
  },
  build: {
    outDir: "out/web",
    rollupOptions: {
      input: {
        index: resolve(__dirname, "src/renderer/index.html"),
      },
    },
  },
  css: {
    postcss: {
      plugins: [tailwindcss, autoprefixer],
    },
  },
  server: {
    port: 3000,
    proxy: {
      "/api/trpc": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
})
