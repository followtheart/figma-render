# figma-render

Render Figma design files to interactive HTML/CSS in the browser.

A monorepo with four packages:

- `@figma-render/core` — Figma API types, fetcher (REST API + local JSON), node tree normalization.
- `@figma-render/renderer` — React components that map Figma nodes to HTML/CSS.
- `@figma-render/server` — Express proxy for the Figma REST API (keeps the access token server-side) with an in-memory LRU cache.
- `@figma-render/web` — Vite + React preview app.

## Quick start

```bash
pnpm install
pnpm dev
# server on :4000, web on :5173
```

Open http://localhost:5173 and either:

1. Paste a Figma file key + personal access token (the token stays on the server and is forwarded only to `api.figma.com`), **or**
2. Drop in a JSON file you exported from Figma (e.g. saved from `GET /v1/files/:key`).

## Development

```bash
pnpm typecheck
pnpm test
pnpm build
```

## Layout

```
packages/
  core/       # data layer
  renderer/   # render layer (React components + style converters)
  server/     # backend proxy
  web/        # Vite + React UI
```

See `/root/.claude/plans/ui-figma-federated-sundae.md` for the design rationale and milestone roadmap.
