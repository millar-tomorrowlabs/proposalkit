import path from "path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Proxy /api/* to production Vercel so the AI chat endpoint works in local dev.
  // The endpoint requires a real Supabase session token anyway, so hitting prod is safe.
  // If you need to test local changes to api/chat.ts itself, run `vercel dev` on a
  // different port and point this target at http://localhost:3000 instead.
  server: {
    proxy: {
      "/api": {
        target: "https://proposl.app",
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
