# Early Warning

A proof of concept for Statera. Project reports record issues, but each report is a snapshot, so a request that goes unanswered week after week never turns into an escalation. Early Warning reads the documents, gives each issue an identity over time, raises explainable alerts, links new issues to similar incidents on other projects, and checks a board paper against the evidence held on its date. A replay bar shows exactly what the system knew on any date, using only documents dated on or before it.

Hosted copy: _add the Vercel URL here after the first deploy_.

## Run the dashboard

No Ollama needed: the data bundle and every language-model output are committed.

```bash
cd frontend && npm install && npm run dev      # development, http://localhost:5173
npm run build && npx serve dist                # or serve the production build from any folder
```

Useful deep links: `#/project/ashfield?asof=2025-06-30&gt=1` opens a project at a date with "Show what actually happened" on.

## Rebuild the data

From the committed cache (no Ollama, no network):

```bash
cd backend && uv sync
EW_OFFLINE=1 uv run python -m app.cli build --source llm
uv run pytest -q
```

From scratch with Ollama (models listed here are the ones used):

```bash
brew install ollama && brew services start ollama
ollama pull qwen3:8b && ollama pull nomic-embed-text
cd backend && uv run python -m app.cli all --source llm --refresh
```

`--source gold` builds the same bundle from the human labels in `data/gold/gold.yaml`, with no extraction by the model. It is the safety net and the reference the evaluation scores against. API for a live setting: `uv run uvicorn app.api:app --reload --port 8000`.

## How it works

- **Extract.** A local model (qwen3:8b through Ollama) reads each document and returns issues as structured JSON, with an exact evidence quote that is checked against the text.
- **Identity.** Embeddings find candidate matches inside a project and the model judges "same issue or not", so a reworded request keeps one age and one history.
- **Rules.** Four simple rules, no model: raised in reports in a row; a deadline the report itself sets (staged 8 weeks, 4 weeks and at the deadline); the issue has now affected the programme; seen before on another project. Every explanation is a template, so each alert can be audited.
- **Cross-project.** A score from wording similarity, category and shared counterparty links an issue to an earlier incident on another project.
- **Board check.** The board paper is split into claims by code; each claim is judged against the evidence held on that date. The budget is checked arithmetically.
- **Replay.** Documents are processed in date order and everything shown at a date uses only documents dated on or before it. Tests enforce this.

## Assumptions

- Two document dates are assumed (marked in `data/manifest.yaml`): the Netherwood snag summary (end of December 2024) and the June board paper (30 June 2025).
- The DNO correspondence summary (10 July 2025) was compiled with hindsight, so it is used only as ground truth and never as replay input.
- Counterparty roles map to shared entities through `data/counterparties.yaml` (the same civils contractor and transformer supplier appear on Netherwood and Drumgarve).
- Thresholds live in `backend/app/config.py`: warnings at 56, 28 and 0 days before a stated deadline, amber at 2 and red at 3 reports in a row, and match scores of 0.60 to show and 0.80 for high confidence.
- `DECISIONS.md` lists every other judgement call.

## What I would do next

- A feedback loop on cross-project matches ("Relevant" and "Not relevant" are captured in the browser but do not train anything yet).
- A real counterparty registry from procurement data instead of a hand-written mapping.
- Push alerts into the project manager's report template.
- Track lessons-learned actions to completion (both Netherwood actions were "not done").
- Stage-based lessons, for example surfacing Netherwood's handover gaps when Ashfield enters commissioning.

## Evaluation results

Run on the 12-document sample, qwen3:8b, prompt v1, scored against `data/gold/gold.yaml`. The model extraction is noisy: it over-extracts, often picks the wrong category, and reads staged deadlines poorly. The alert rules and the lead time do not depend on those weaknesses for the Ashfield story.

| Measure | Result |
| --- | --- |
| Mention recall | 93% |
| Mention precision | 68% |
| Category accuracy | 46% |
| Status accuracy | 69% |
| Trigger deadline accuracy | 25% |
| Evidence quote validity | 100% |
| Same-issue pairwise precision | 100% |
| Same-issue pairwise recall | 88% |
| Expected cross-project matches found | 2 of 3 (Drumgarve access track to Ashfield crane visit not found), 0 false positives |
| Board claim "Low risk, expected to be confirmed shortly." | Contradicted by the model, no fallback needed |

Lead time on the Ashfield DNO issue against the actual escalation on 3 Jul 2025:

| Alert | Date | Days before escalation |
| --- | --- | --- |
| First warning (deadline staged 8 weeks ahead) | 5 May 2025 | 59 |
| First red alert | 2 Jun 2025 | 31 |
| Persistence rule alone | 16 May 2025 | 48 |

Known weaknesses of the committed run: several board claims other than the key one are judged more harshly than the human labels; two Drumgarve matches show medium rather than high confidence; some Netherwood past incidents are labelled as live programme impact, which turns Netherwood red. Switch to the gold bundle (`build --source gold`) if a cleaner demo is needed.
