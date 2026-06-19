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
