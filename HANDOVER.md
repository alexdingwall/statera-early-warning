# Handover

Written at the end of a long session so a fresh session can carry on. Read this, then `PLAN.md` (original build plan), `DECISIONS.md` (one line per judgement call) and `README.md` (user-facing). Where this file and `PLAN.md` disagree, this file is newer.

Repo: `/Users/alexdingwall/Documents/statera-early-warning`, branch `main`, last commit `d72dba7`. `.claude/` is untracked on purpose (local settings). Do not commit the brief PDF.

## 1. What this is

"Early Warning", a proof of concept for a Statera take-home (Software Engineer / Business Systems, Python AI). It reads project documents with a local LLM, tracks each issue over time, raises explainable alerts, links issues to earlier incidents on other projects, checks a board paper against the evidence, and shows it all in a static dashboard with a date replay. The demo story is Ashfield, March to July 2025: the DNO date is unconfirmed from 21 Mar, the system warns on 5 May, goes red on 2 Jun, and the real escalation happened on 3 Jul.

## 2. State: what is done and working

All seven phases of the plan are done except the Vercel deploy (section 6). On top of the plan, three rounds of rework followed user feedback (sections 4 and 5).

- **Backend** (`backend/app/`, Python 3.12, uv): loaders, `llm.py` (disk-cached Ollama wrapper, `EW_OFFLINE=1` forbids new calls), `extract.py`, `identity.py`, `rules.py`, `crossproject.py`, `boardcheck.py`, `status.py`, `evaluate.py`, `export.py`, `pipeline.py`, `api.py`, `cli.py`.
- **Tests:** `cd backend && uv run pytest -q` gives 29 passing: rule unit tests, a gold-bundle test (exact ASH-DNO alert list, cross-project matches, board check, lead times 59/31/48 days) and a leakage test run on both gold and the cached LLM build.
- **Data bundle:** `frontend/public/data/bundle.json` is the LLM build (qwen3:8b, prompt v2) and is committed. All LLM outputs are in `cache/llm/` (about 325 files, 3 MB, committed), so `EW_OFFLINE=1 uv run python -m app.cli build --source llm` rebuilds with no Ollama.
- **Frontend** (`frontend/`, Vite + React + TypeScript + Tailwind v4 + shadcn components, `HashRouter`): builds clean with `npm run build`. Static; it only reads `data/bundle.json`.

Commands (from `backend/`):

```bash
uv run python -m app.cli extract --source llm [--refresh]   # fills cache; needs Ollama
uv run python -m app.cli build   --source llm|gold          # writes frontend/public/data/bundle.json
uv run python -m app.cli eval    --source llm|gold          # prints the evaluation table
uv run python -m app.cli all     --source llm               # extract + build + eval
EW_OFFLINE=1 uv run python -m app.cli build --source llm    # from cache only
```

Frontend (from `frontend/`): `npm run dev`, `npm run build`, `npx vite preview --port 4173`.
Deep links for demos and screenshots: `#/?asof=2025-06-23&item=DRU-007`, `#/project/ashfield?asof=2025-06-30&gt=1`, `#/project/ashfield?view=lessons`.

## 3. Evaluation (prompt v2, committed run)

| Measure | v1 (plan wording) | v2 (current) |
| --- | --- | --- |
| Mention recall | 93% | 96% |
| Mention precision | 68% | 71% |
| Category accuracy | 46% | 96% |
| Status accuracy | 69% | 78% |
| Trigger deadline accuracy | 25% | 50% |
| Quote validity | 100% | 100% |
| Same-issue precision / recall | 100% / 88% | 100% / 88% |
| Expected cross-project matches | 2 of 3 | 3 of 3, 0 false positives |

Lead time on the Ashfield DNO issue (mapped LLM id `ASH-001`): first warning 5 May 2025 (59 days before 3 Jul), first red 2 Jun (31 days), persistence alone 16 May (48 days). No fallbacks used. These numbers are in `README.md`.

## 4. Decisions made (beyond `PLAN.md`)

`DECISIONS.md` has the one-liners; the reasoning that matters:

**Plan deviations and additions**
- Branch renamed `master` to `main`; backend is a flat non-packaged uv app (no `src/` layout).
- Board claims keep fragments of 2 or more words (plan said 3) because gold expects "Construction complete." and only "Weather" should drop.
- Gold-mode programme snapshots come from regexes over each document's programme block (`gold.yaml` has none). In LLM mode too: the model never supplies programme figures any more (it invented float and dates). `parse_programme` in `extract.py` is the only source.
- Embeddings are used in gold mode as well (cross-project cosine), read from the committed cache. A gold rebuild on a machine with an empty cache would need Ollama for embeddings only.
- Identity enforces one mention per issue per document first-come, not by highest score.
- Identical staged alerts (same issue, rule, stage, day, from triggers in different documents) are merged in `rules.compute`; remaining id collisions get a numeric suffix.
- Gold build shows two extra cross-project matches beyond the three expected (DRU-COND9 to NET-PLANNING, ASH-SNAG to NET-FIRMWARE); neither is on the no-match list.
- The shadcn CLI generated `cn` imports from an unrelated npm package called `cn`. Replaced with a local clsx-only `cn` in `frontend/src/lib/utils.ts`; removed that package and the Geist font package. Consequence: no `tailwind-merge`, so class overrides depend on order (the drawer width uses `!` modifiers).
- The demo bundle is the LLM build because it passes the plan's gates (first ASH-DNO alert 5 May, "Low risk" claim contradicted with no fallback, at least 2 of 3 matches).

**Extraction prompt v2** (`SYSTEM_PROMPT` in `extract.py`, `PROMPT_VERSION = "v2"` in `config.py`): category definitions, status rules (occurred = past incident in retrospective or lessons documents), "triggers are normally empty" and the document date is never a trigger, group checklist items into one issue, name the underlying problem not the lesson. Code guards on top: a `materialised` status on a retrospective document type (`commissioning_summary`, `lessons_learned`) becomes `occurred`; retrospective documents get no triggers; counterparty roles with underscores are normalised. Quote spans: exact match, then case-insensitive, then fuzzy snapped to whole words (this fixed a highlight that started mid-word).

**Frontend reframe** (after the user said the first dashboard "doesn't scream usable"): the main screen is an **action queue**, not status cards.
- One decision per issue with an active red or amber alert (`frontend/src/lib/actions.ts`). Ranked: still preventable first, then problems already affecting the programme; then severity; then nearest stated deadline.
- Everything on it is templated from data and rules, no model text: recommended action ("Escalate formally to DNO before 30 Jun 2025 (7 days left)" or "Agree a recovery plan..."), suggested owner (project PM), why now (consecutive open reports, chases, the report's own conditional sentence), stakes (float, forecast vs baseline, commercial date), and "Last time" (matched earlier incident with dated, linked source documents, a link to the earlier issue, and the agreed lesson action with its status).
- Escalate / Acknowledge / Snooze are stored in browser `localStorage` only (key `ew-actions`). Nothing is sent anywhere. Handled items move to a Handled tab with Reopen.
- Portfolio top strip shows a compact tile per project (reported vs evidence, divergence flag, to-decide count, float). The project view leads each issue with the same recommendation. Lessons are a per-project tab (`?view=lessons`), fed by `data/lessons.yaml`.
- `data/lessons.yaml` is hand-entered from the Netherwood lessons workshop (3 actions, owners, status as written: Not done, Not done, Drafted, and where each applies: alert rules, counterparty, or project phase). It is not model-extracted. Exported as `bundle.lessons`.
- The action detail panel scrolls internally on short screens instead of truncating text (user dislikes needless truncation). At 1440x900 it does not scroll.
- Taste inspector (`--app`) left only defended findings: the plan-mandated uppercase "PROJECT DELIVERY" label, blank space inside stretched cards at 1440x900, and no h1 at 768/390 px (the plan asks for a "Best viewed on a larger screen." message, not a mobile layout). Re-run it on the new Portfolio, Lessons and project views (not done since the reframe).

## 5. User preferences and feedback so far

- Wants a tool a portfolio manager can act on to **prevent** issues, not a record of what happened elsewhere. Judge every screen by "what do I do about this, by when".
- Dislikes needless truncation; give full text or wrap, and link to the when and what behind any claim.
- British English, user-facing dates as `16 May 2025`.
- Cares about highlight accuracy in source documents.
- Prefers redesign by me with screenshots for reaction, then polish. Questions only for real decisions.
- Pronouns: use they/them for the user.
- Account: Vercel username `alexdingwall`, signed in. Vercel CLI 65.3.1 is logged in and the Vercel plugin for Claude Code was installed by the user.
- A permission prompt once timed out for the user; the command that was blocked was never identified (all commands in that stretch had completed). If something seems missing, ask.

## 6. Still to do

**Must do (plan Phase 7 remainder)**
1. **Deploy to Vercel** (not done). From `frontend/`: `npx vercel --prod`, accept the detected Vite settings (build `npm run build`, output `dist`; `base: "./"` is already set). Put the URL in `README.md` (placeholder line near the top) and commit. Private repo is fine. Consider whether the Vercel project should be password-protected or restricted, since the repo holds employer exercise material and the bundle embeds all 12 document texts.
2. **README update:** "How it works" and "What I would do next" do not yet mention the action queue, the Lessons tab or `data/lessons.yaml`. Say clearly that Escalate / Acknowledge / Snooze are local only.
3. **Re-run the Taste inspector** (`node ~/.claude/plugins/cache/taste-skill/taste-skill/2.1.5/skills/taste-skill/scripts/inspect.mjs --app <url>`) on Portfolio, project, Lessons, Board, Alerts, Evaluation, Sources at 1280x720 and 1920x1080. Check no page scroll at 1280x720 (screenshots only so far, headless Chrome `--window-size=1280,720`).
4. **Keyboard walk-through** of the demo story using only the keyboard (left/right, Space, G, 1 to 8, Esc). Never exercised in a real browser. Note Space is global and `preventDefault`ed; check focused buttons still work.
5. **Human tasks from the plan:** record a 2-minute screen capture of the demo story as a backup (not committed); add the reviewers as collaborators on the private repo or send a zip; create the GitHub remote if wanted (currently no remote; `gh repo create statera-early-warning --private --source=. --push`).
6. Final checks per plan checkpoint 7: `cd backend && uv run pytest -q`, `cd frontend && npm run build`, clean `git status` after commit.

**Should do (quality, in rough priority)**
- **Decide-by dates rely on model-read triggers (50% correct).** Example: Drumgarve swept path shows 30 Jun where the document implies 26 Jun. Options: more prompt work on triggers, or label the date "stated in report" and show the quote next to it (the quote is already in Why now).
- **Board check verdicts are too harsh.** 5 of 7 claims come back contradicted vs 2 in gold; only "Low risk" has the plan's retry-and-fallback. The Board view defaults to the first contradicted claim, which is "Construction complete." Consider a v2 `board_claim` prompt with the verdict definitions tightened, or default-select the key claim. Do not hide the weakness; the Evaluation page already lists fallbacks.
- **Precision is 71%**: the model still lists budget lines and checklist items as issues, which adds noise to the queue ("Contingency costs incurred", "Weather delays impacting budget"). A deterministic filter for cost-category mentions from `board_update` documents is an option.
- Netherwood has 0 to decide and "On track" with a "No status report" pill; that is intended, but the Portfolio tile gives it little to say. Fine for a retrospective project.
- Remaining truncation in narrow places (queue row titles, alerts table explanation, source titles). User may raise these; prefer wrapping or widening.
- Replay bar still takes 72px; user was asked whether to shrink it (unanswered).
- The "Seen before" matcher shows weak matches in places (for example Ashfield snagging vs Netherwood firmware). Confidence labels are shown.
- No frontend tests. Backend tests are solid.
- Stale cache files from prompt v1 remain in `cache/llm/` (harmless, about half the files). Delete only if repo size matters; keys include prompt version so v2 never reads them.

**Out of scope (per plan section 10):** auth, upload UI, database, email or Slack alerts, editing issues, a real counterparty registry, retraining from feedback, mobile layout, dark mode.

## 7. Gotchas

- Changing `PROMPT_VERSION`, the extraction prompt or `LLM_MODEL` invalidates the cache; a full re-extract is about 10 minutes on this Mac (qwen3:8b), and `eval` or the LLM pytest param then need identity judgements (several more minutes). `llm.py` retries invalid JSON twice.
- `pytest` includes an LLM-mode leakage test that builds from cache; if the cache is incomplete it is skipped, but with Ollama running and an incomplete cache it will call the model and slow down (it took about 5 minutes the first time).
- `PLAN.md` says gold mode needs no Ollama; in practice the committed embedding cache makes that true.
- Quote spans are computed in `extract._to_mention` from cached model responses, so span fixes only need a rebuild, not a re-run.
- `build` rewrites `bundle.json` with a new `generated_at`, so it shows as modified in git after any build; commit it when the data changed.
- shadcn components are in `frontend/src/components/ui/` (Sheet and Tooltip are base-ui based). The drawer is the only intended scrolling element besides the action detail panel and tab content.
- A `vite preview` server may still be running on port 4173 from this session (`pkill -f "vite preview"` to stop).
- Screenshots used for review are in the session scratchpad and not part of the repo.

## 8. File map (current)

```
PLAN.md  CLAUDE.md  DECISIONS.md  README.md  HANDOVER.md
data/ docs/ (12 originals)  manifest.yaml  projects.yaml  counterparties.yaml  lessons.yaml  gold/gold.yaml
backend/app/  config models loaders llm extract identity rules crossproject boardcheck status evaluate export pipeline api cli
backend/tests/  test_rules  test_pipeline_gold  test_no_leakage
cache/llm/  committed LLM and embedding outputs
frontend/src/
  store.ts types.ts App.tsx
  lib/  selectors.ts (as-of selectors, headline, lessons) actions.ts (action queue) format.ts utils.ts
  components/  Shell.tsx (top bar, replay bar, sidebar, keys) ActionDetail.tsx IssueTimeline.tsx SourceDrawer.tsx ui-bits.tsx ui/ (shadcn)
  views/  Portfolio.tsx Project.tsx Lessons.tsx Alerts.tsx Board.tsx Evaluation.tsx Sources.tsx
frontend/public/data/bundle.json
```

## 9. Suggested first steps for the next session

1. `git status` and `git log --oneline | head`; confirm clean at `d72dba7`.
2. `cd backend && uv run pytest -q` and `cd ../frontend && npm run build`.
3. Ask the user whether to deploy now or first polish (items under "Should do"), then do section 6 items 1 to 3.
4. Walk the demo story in a browser at 1280x720: `#/?asof=2025-03-21` (Ashfield first raises DNO), 5 May (first warning), 30 May (Drumgarve visit, access track and transformer matches), 30 Jun (board paper, `#/board`), 4 Jul (slip reported, "Show what actually happened" on).
