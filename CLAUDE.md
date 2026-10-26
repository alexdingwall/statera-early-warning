# CLAUDE.md
- Source of truth: PLAN.md. Follow phases in order.
- Python 3.12 via uv. Run backend commands from backend/: `uv run ...`.
- Frontend: Node 22+, Vite, React, TypeScript, Tailwind v4, shadcn/ui. Run from frontend/.
- All LLM calls go through backend/app/llm.py (disk cache in cache/llm). Never call ollama elsewhere.
- Never use a document dated after the as-of date for anything shown at that date.
- British English. User-facing dates as "16 May 2025".
- No new dependencies without a line in DECISIONS.md.
- Commit after every checkpoint.
