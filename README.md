# Early Warning

A proof of concept for Statera. Project reports record issues, but each report is a snapshot, so a request that goes unanswered week after week never turns into an escalation. Early Warning reads the documents, gives each issue an identity over time, raises warnings that explain themselves, and shows a project manager what to decide this week.

**Try it:** https://statera-early-warning.vercel.app (read-only, kept out of search engines; the documents are synthetic). Open it, step to 5 May 2025 with the arrow keys, and click Review. Press `?` for a short guide.

It runs on a replay: pick any date and the system shows only what was known on that date, using documents dated on or before it.

## What it found

On the sample (three projects, 12 documents), replayed against what really happened:

- **A warning 59 days early.** Ashfield's grid connection (DNO) date was unconfirmed in March. The first warning came on 5 May 2025; the formal escalation was on 3 Jul 2025. The persistence rule alone fired 48 days before, and the first red alert 31 days before.
- **Reported status and evidence disagree.** On 3 Jun 2025 Ashfield's report says on programme, while the DNO issue in the same evidence is red. Both are quoted, with a link to the source.
- **Drumgarve repeats Netherwood's problems.** Its transformer supplier and civils contractor already had a record on Netherwood. A watch note appears five weeks before the transformer issue is first reported.
- **Board paper claims.** Each claim is checked against the evidence held that day: 3 of 7 claims in the June paper are contradicted (the human labels expect 2).

How far to trust this: one issue in 12 documents is an illustration, not proof. The rules were set after reading the story, and trigger dates are read correctly only half the time. Precision is 71%, so a real queue would need tuning before anyone relied on it. Full numbers are under [Evaluation results](#evaluation-results).

## Who uses it, and what they do differently

| Who | When | What they do differently |
| --- | --- | --- |
| Project manager | Before writing the weekly report | Escalates a repeating issue early, with the evidence, instead of writing it up again |
| Delivery director | Before the board update | Checks each claim against the evidence held that day |
| Procurement | When appointing a supplier | Sees that supplier's record on other projects before committing |
| Portfolio lead | Monday morning | Sees which projects are really at risk without reading every report |

A decision stays handled until something new arrives on that issue, then it returns with the reason. It prompts a decision. It does not send anything, change a report or replace the project manager's judgement.

## Judgement calls and scope

- **The model reads, rules decide.** A local model (qwen3:8b through Ollama) extracts issues and quotes. Warnings come from four plain rules with templated explanations, so each one can be audited. No data leaves the computer.
- **Replay by date.** Nothing dated after the as-of date is used for anything shown at that date, and tests enforce it. This is what makes "did it warn in time" an honest question.
- **Built on purpose:** the early warning, the replay that checks it against what happened, the watch notes (prevention before any alert), a board-paper check and an Add a report page.
- **Left out on purpose:** login and a shared database (decisions are saved in the browser only), email or Slack alerts, reading SharePoint directly, editing issues in the app and a mobile layout. Each needs live systems, and I would rather test the queue with a real project manager first.
- **Known gaps:** a report that gives a new date does not yet replace the old deadline, and a report filed late can shift issue numbers.
- `DECISIONS.md` lists every other judgement call.

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

`--source gold` builds the same bundle from the human labels in `data/gold/gold.yaml`, with no extraction by the model. It is the reference the evaluation scores against. API for a live setting: `uv run uvicorn app.api:app --reload --port 8000`.

## How it works

- **Extract.** A local model (qwen3:8b through Ollama) reads each document and returns issues as structured JSON, with an exact evidence quote that is checked against the text.
- **Identity.** Embeddings find candidate matches inside a project and the model judges "same issue or not", so a reworded request keeps one age and one history.
- **Rules.** Four simple rules, no model: raised in reports in a row; a deadline the report itself sets (staged 8 weeks, 4 weeks and at the deadline); the issue has now affected the programme; seen before on another project. Every explanation is a template, so each alert can be audited.
- **Cross-project.** A score from wording similarity, category and shared counterparty links an issue to an earlier incident on another project.
- **Board check.** The board paper is split into claims by code; each claim is judged against the evidence held on that date. The budget is checked arithmetically.
- **Action queue.** The main screen lists one decision per issue with an active red or amber alert, ranked by whether it can still be prevented, then severity, then the nearest deadline. The recommended action, suggested owner, why now, stakes and "last time" are templated from data and rules, not written by the model. Decide-by dates are the ones the report itself states.
- **Watch notes.** Prevention before any alert: if a counterparty has already caused a problem of one kind on another project, and this project uses it and has not raised the same kind of issue yet, a note says what happened and what to do early. Templated, no model. The note stops once the project's own issue appears. At present it fires for Drumgarve's transformer supplier (from 31 Dec 2024, five weeks before the issue appears on 7 Feb) and its civils contractor (until 30 May).
- **New information.** Everything is derived from the issue history and a date, so a new report moves tiers and warnings by itself. The Portfolio lists what is new since the previous report. A decision (escalated, acknowledged, snoozed) stands until something new arrives on that issue: a later report, a new warning, or a snoozed deadline within 7 days. Then it returns to the queue with the reason. A decision only counts from the date it was made, so the replay stays correct.
- **Add a report.** The Add a report page takes a file (.txt or .md), confirms project, type and date (guessed from the file, then checked by the person), has the local model read it, and recalculates everything. It needs the backend running on the same computer (`uv run uvicorn app.api:app --port 8000`) and Ollama; the hosted copy is read-only. Added reports are kept apart from the sample (`data/uploads/`, git-ignored) and can be removed in one click. A synthetic sample report (clearly marked, following the real week 27) is included so the demo works instantly. Added reports are left out of the evaluation scores because they have no human labels.
- **Lessons.** A per-project tab shows the actions agreed after the Netherwood workshop and where each applies. They are hand-entered in `data/lessons.yaml`, not extracted by the model.
- **Replay.** Documents are processed in date order and everything shown at a date uses only documents dated on or before it. Tests enforce this.

Escalate, Acknowledge and Snooze are stored in the browser only (`localStorage`). Nothing is sent anywhere.

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

Run on the 12-document sample, qwen3:8b, prompt v2, scored against `data/gold/gold.yaml`. The first prompt (v1) scored category 46%, status 69%, trigger dates 25% and found 2 of 3 expected matches; v2 adds category definitions, status rules for retrospectives, and "triggers are normally empty".

| Measure | Result |
| --- | --- |
| Mention recall | 96% |
| Mention precision | 71% |
| Category accuracy | 96% |
| Status accuracy | 78% |
| Trigger deadline accuracy | 50% |
| Evidence quote validity | 100% |
| Same-issue pairwise precision | 100% |
| Same-issue pairwise recall | 88% |
| Expected cross-project matches found | 3 of 3, 0 false positives |
| Board claim "Low risk, expected to be confirmed shortly." | Contradicted by the model |
| Board claims contradicted in the June paper | 3 of 7 (the human labels expect 2) |

Lead time on the Ashfield DNO issue against the actual escalation on 3 Jul 2025:

| Alert | Date | Days before escalation |
| --- | --- | --- |
| First warning (deadline staged 8 weeks ahead) | 5 May 2025 | 59 |
| First red alert | 2 Jun 2025 | 31 |
| Persistence rule alone | 16 May 2025 | 48 |

Known weaknesses of the committed run: precision is 71% because the model still lists budget lines and checklist items as issues; some board claims other than the key one are judged more harshly than the human labels; trigger dates are right half the time. Programme figures (baseline, forecast, float) are read from the documents by code, not by the model. The lessons-learned actions on the Lessons tab are hand-entered in `data/lessons.yaml`.
