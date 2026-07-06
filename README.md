# Proposl

AI proposal builder. React + Vite + Supabase, deployed on Vercel.

## Environments

| Environment | Branch | URL | Supabase project |
| --- | --- | --- | --- |
| Production | `main` | proposl.app | `nkygheptubvogevezpap` (ProposalKit) |
| Staging | `develop` | staging.proposl.app | `gpeeosckqysietgryovm` (proposl-staging) |
| Preview | feature branches | per-deploy Vercel URL | `gpeeosckqysietgryovm` (staging) |

- `main` deploys to production. Never push to it directly — open a PR.
- `develop` and all feature-branch previews run against the **staging** Supabase, so schema changes, RLS tweaks, and migrations can be tested without touching production data.
- Vercel env vars are scoped per target: Production vars point at the prod Supabase, Preview vars at staging. The server reads `SUPABASE_URL` (falls back to `VITE_SUPABASE_URL`).

### Working with Supabase

- The CLI is linked to prod by default. `supabase link --project-ref <ref>` to switch.
- Apply migrations: `supabase db push` (after `link`-ing the target project).
- Deploy all edge functions: `scripts/deploy-functions.sh <project-ref>`.
- Staging email: Resend is intentionally **not** configured on staging so test sends never affect production sending reputation.

## Local development, including /api

`npm run dev` serves the Vercel `/api/*` handlers **locally** (INT-25): a vite plugin in `vite.config.ts` mounts each `api/<name>.ts` through Vite's SSR pipeline, so edits to `api/chat.ts` hot-reload like any other file. Streaming works. Requirements:

- `.env.local` must contain the server-side vars (`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, plus the `VITE_*` client vars). Copy `.env.example` and fill it in.
- Without `SUPABASE_SERVICE_ROLE_KEY`, the dev server falls back to the old behavior of proxying `/api` to production, which only exercises the deployed handlers.

Quick check that the local handlers are live: `curl http://localhost:5173/api/nope` returns `{"error":"No api/nope.ts handler"}` (the prod proxy would return a Vercel 404 page instead).

`vercel dev` remains an alternative if you need Vercel's exact runtime semantics.

## Proposl MCP server

`/api/mcp` is a remote MCP server (streamable HTTP, stateless) that lets Claude read and write proposals directly: `list_proposals`, `get_proposal`, `create_proposal`, `set_section_content` (verbatim), `import_document` (verbatim, many sections), `set_investment`, `set_next_steps`, `add_context_source`, `get_preview_url`. Sending proposals is deliberately not exposed.

- Create a token in Account settings (API tokens). Only its SHA-256 hash is stored (`api_tokens` table); the plaintext is shown once.
- Connect: `claude mcp add --transport http proposl https://proposl.app/api/mcp --header "Authorization: Bearer <token>"`
- Every query is scoped to the token's account server-side. Revoking a token in settings cuts access immediately.

## React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
