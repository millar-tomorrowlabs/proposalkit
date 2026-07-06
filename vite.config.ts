import fs from "fs"
import path from "path"
import type { IncomingMessage, ServerResponse } from "http"
import { defineConfig, loadEnv, type Plugin } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

/**
 * Serves the Vercel /api/* handlers inside `vite dev` (INT-25), so changes to
 * api/chat.ts etc. are testable locally without a preview deploy.
 *
 * Handlers load through Vite's SSR pipeline (TypeScript + hot reload for
 * free) and run in the dev-server process with env from .env.local. Two
 * handler shapes are supported:
 *   - edge-style: default export (req: Request) => Promise<Response>
 *   - node-style: default export (req, res) => void  (arity >= 2)
 */
function localApi(): Plugin {
  return {
    name: "proposl-local-api",
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        if (!req.url?.startsWith("/api/")) return next()
        const name = req.url.slice("/api/".length).split("?")[0].replace(/\/+$/, "")
        // Simple names only — no nested paths, no traversal.
        if (!/^[a-z0-9-]+$/i.test(name)) return next()
        const file = path.resolve(__dirname, `api/${name}.ts`)
        if (!fs.existsSync(file)) {
          res.statusCode = 404
          res.end(JSON.stringify({ error: `No api/${name}.ts handler` }))
          return
        }
        try {
          const mod = await server.ssrLoadModule(`/api/${name}.ts`)
          const handler = mod.default
          if (typeof handler !== "function") {
            throw new Error(`api/${name}.ts has no default export function`)
          }

          // Node-style handler: hand over the raw req/res.
          if (handler.length >= 2) {
            await handler(req, res)
            return
          }

          // Edge-style handler: adapt Node req -> fetch Request.
          const url = `http://${req.headers.host ?? "localhost"}${req.url}`
          const headers = new Headers()
          for (const [k, v] of Object.entries(req.headers)) {
            if (typeof v === "string") headers.set(k, v)
            else if (Array.isArray(v)) headers.set(k, v.join(", "))
          }
          let body: Buffer | undefined
          if (req.method && !["GET", "HEAD"].includes(req.method)) {
            const chunks: Buffer[] = []
            for await (const chunk of req) chunks.push(chunk as Buffer)
            body = Buffer.concat(chunks)
          }
          const response: Response = await handler(new Request(url, { method: req.method, headers, body }))

          res.statusCode = response.status
          response.headers.forEach((v, k) => res.setHeader(k, v))
          if (response.body) {
            // Pump chunk by chunk so streaming endpoints (chat) stream in dev too.
            const reader = response.body.getReader()
            for (;;) {
              const { done, value } = await reader.read()
              if (done) break
              res.write(value)
            }
          }
          res.end()
        } catch (err) {
          console.error(`[local-api] /api/${name} failed:`, err)
          if (!res.headersSent) {
            res.statusCode = 500
            res.setHeader("Content-Type", "application/json")
          }
          res.end(JSON.stringify({ error: `Local /api/${name} handler failed: ${String(err)}` }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // Load .env/.env.local with no prefix filter so server-side vars
  // (SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY) reach the local /api
  // handlers. Real env vars win over file values.
  const env = loadEnv(mode, __dirname, "")
  for (const [k, v] of Object.entries(env)) {
    if (!(k in process.env)) process.env[k] = v
  }
  // Without the server keys (fresh clone), local handlers can't run; fall
  // back to proxying /api to production, which works for endpoints that
  // already exist in prod (requires a real session token anyway).
  const hasServerKeys = !!process.env.SUPABASE_SERVICE_ROLE_KEY

  return {
    plugins: [react(), tailwindcss(), ...(hasServerKeys ? [localApi()] : [])],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: hasServerKeys
      ? {}
      : {
          proxy: {
            "/api": {
              target: "https://proposl.app",
              changeOrigin: true,
              secure: true,
            },
          },
        },
  }
})
