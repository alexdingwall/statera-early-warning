# Decisions

- Branch renamed from master to main; PLAN.md copied into the repo root.
- Backend is a flat, non-packaged uv app (no build backend): `uv init --app` created a src layout, which was removed so `app.*` imports work from `backend/`.
- pytest `pythonpath = ["."]` in backend/pyproject.toml so tests import `app`.
- Frontend: added dev dependency `@types/node` (needed for the `@/` alias in vite.config.ts). shadcn init added its own dependencies (radix-ui, class-variance-authority, tailwind-merge, tw-animate-css, @fontsource-variable/geist); the Geist font will be replaced by Montserrat and Inter in Phase 6.
- TypeScript `baseUrl` omitted (deprecated); `paths` alone resolves `@/*`.
