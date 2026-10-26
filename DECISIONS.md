# Decisions

- Branch renamed from master to main; PLAN.md copied into the repo root.
- Backend is a flat, non-packaged uv app (no build backend): `uv init --app` created a src layout, which was removed so `app.*` imports work from `backend/`.
- pytest `pythonpath = ["."]` in backend/pyproject.toml so tests import `app`.
- Frontend: added dev dependency `@types/node` (needed for the `@/` alias in vite.config.ts). shadcn init added its own dependencies (radix-ui, class-variance-authority, tailwind-merge, tw-animate-css, @fontsource-variable/geist); the Geist font will be replaced by Montserrat and Inter in Phase 6.
- TypeScript `baseUrl` omitted (deprecated); `paths` alone resolves `@/*`.
- Board claim splitting keeps fragments of 2+ words (plan says under 3 words are dropped), because gold expects the 2-word claim "Construction complete." and only the 1-word "Weather" should drop.
- Gold-mode programme snapshots are read deterministically from each document's programme block with regexes (gold.yaml holds no programme values).
- Embeddings (cross-project matching) are used in gold mode too, read from the committed cache, so a gold rebuild on a machine with an empty cache needs Ollama for embeddings only.
- Identity: one mention per issue per document is enforced first-come in document order, not by highest score as the plan words it.
- Duplicate alert ids (two triggers staging the same stage on one issue) get a numeric suffix.
- Gold build also shows two extra cross-project matches beyond the three expected (DRU-COND9 to NET-PLANNING, ASH-SNAG to NET-FIRMWARE), neither on the no-match list.
- Phase 2 code was committed together with Phase 3.
- Demo bundle is the LLM build: it passes the plan's gates (first ASH-DNO alert 5 May 2025, "Low risk" claim contradicted with no fallback, 2 of 3 expected matches found). Known weaknesses are shown on the Evaluation page: over-extraction (precision 68%), category accuracy 46%, trigger dates 25%, DRU-ACCESS to ASH-CRANE not matched, and the two Drumgarve matches are medium rather than high confidence.
