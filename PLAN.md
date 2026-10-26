# Early Warning: build plan for Claude Code

Proof of concept for the Statera take-home (Software Engineer / Business Systems, Python AI).
This file is the single source of truth. Claude Code: read all of it before writing any code.

---

## 0. How Claude Code should work through this plan

1. Work phase by phase, in order. Do not start a phase before the previous checkpoint passes.
2. At each **CHECKPOINT**, run the listed commands, report results in 3 to 6 lines, commit with the given message, then continue. Stop and ask the human only if a checkpoint fails twice.
3. Do not invent facts that are not in the documents. Every date, number and name in the data files below has been checked by a human. Copy them exactly.
4. Keep to the file layout in section 3. Do not add frameworks, databases or services that are not listed.
5. All LLM calls go through `backend/app/llm.py`, which caches to disk. Never call Ollama from anywhere else.
6. British English in all UI copy and docs. Dates shown to users as `16 May 2025`. Dates in data as ISO `2025-05-16`.
7. If something in this plan is ambiguous, pick the simplest option that satisfies the acceptance tests, write the decision in `DECISIONS.md` (one line each), and carry on.
8. Time budget is about 4 hours total including human setup. Prefer working and plain over clever.

---

## 1. What we are building (context for every phase)

**Problem.** Statera's project documents record issues, but each report is a snapshot. Nothing gives an issue an identity over time, so a repeated unanswered request never turns into an escalation. Nothing links an issue to similar past incidents on other projects. Board papers summarise status without being checked against the evidence.

**Product.** "Early Warning", an internal tool that:

1. Extracts issues from each document with a local LLM (Ollama).
2. Tracks each issue across documents (same issue, different wording) so it has an age, a mention history and a status.
3. Raises alerts from simple, explainable rules: persistence, self-declared triggers (staged in advance), realised impact, and "seen before on another project".
4. Matches new issues to earlier incidents on other projects.
5. Checks a board paper's claims against the evidence held at that date.
6. Shows all of it in a dashboard with a **replay**: pick any date and see exactly what the system knew and would have flagged on that date, using only documents dated on or before it.

**The demo story (everything must serve this):**

1. Replay Ashfield from March to July 2025. The DNO issue appears on 21 Mar 2025 with the PM's own trigger ("will become so if it slips past June"). The system warns on 5 May 2025 (8 weeks before that deadline), again on 16 May (persistence) and goes red on 2 Jun. The real formal escalation happened on 3 Jul 2025.
2. Board check on the June board paper: "Low risk, expected to be confirmed shortly" is contradicted by the evidence.
3. Drumgarve site visit (30 May 2025): the access track issue matches Ashfield's second crane visit; the swept path delay matches Netherwood's contractor delay; the transformer lead time matches Netherwood's transformer delay.
4. Portfolio view: three projects, each with reported status vs evidence-based status.

**Must work without the author's laptop.** The frontend is a static site reading one JSON bundle. The bundle and all LLM outputs are committed, so anyone can run or host it without Ollama.

---

## 2. Human setup (Alex does this before opening Claude Code, about 25 minutes)

Run in Terminal on the MacBook.

### 2.1 Tools

```bash
# Command line tools (skip if git already works)
xcode-select --install

# Homebrew (skip if `brew -v` works)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

brew install git gh uv node ollama
node -v   # must be 22 or higher (Taste skill needs Node 22+)
uv --version
```

Google Chrome must be installed (the Taste skill checks pages in a real browser).

### 2.2 Ollama and models

```bash
brew services start ollama          # runs the server in the background
ollama pull qwen3:8b                # about 5 GB, main model
ollama pull nomic-embed-text        # embeddings
ollama run qwen3:8b "Reply with OK" # smoke test, Ctrl+D to exit
```

16 GB is enough for an 8B model. Close heavy browser tabs while extraction runs. If `qwen3:8b` gives broken JSON repeatedly, `ollama pull llama3.1:8b` and change `LLM_MODEL` in `backend/app/config.py`.

### 2.3 Repository

Keep the repo **private** (it contains the employer's exercise material).

```bash
gh auth login                        # choose GitHub.com, HTTPS, browser login
cd ~/code   # or wherever you keep projects
gh repo create statera-early-warning --private --clone
cd statera-early-warning
mkdir -p data/docs
```

Copy the 12 sample documents into `data/docs/` with their **exact original filenames** (some contain spaces):

```
ASHFIELD_weekly_progress_wk12_2025.txt
ASH_grid_correspondence_summary.txt
Drumgarve_transformer_leadtime_Feb2025.txt
ashfield_weekly_wk19.md
Netherwood handover pack - status.txt
netherwood commissioning snags 2024.txt
drumgarve weekly wk24.txt
drumgarve_planning_conditions.md
ashfield-weekly-wk27.txt
netherwood_lessons_learned.md
drumgarve_site_visit_2025-05-30.txt
ashfield_monthly_board_update_June.md
```

Do **not** commit the brief PDF. Put this file in the repo root as `PLAN.md`.

### 2.4 Claude Code

```bash
claude
```

Inside Claude Code:

```
/model            -> choose Sonnet 5.5
/plugin marketplace add Leonxlnx/taste-skill
/plugin install taste-skill@taste-skill
```

Then give it this prompt:

> Read PLAN.md fully. Then execute it from Phase 1, stopping only where the plan says to. Report at each checkpoint.

### 2.5 Hosting account (needed in Phase 7)

Create a free Vercel account and sign in with GitHub. GitHub Pages is not used because Pages on a private repo needs a paid plan.

---

## 3. Repository layout (final state)

```
statera-early-warning/
  PLAN.md
  CLAUDE.md
  DECISIONS.md
  README.md
  .gitignore
  data/
    docs/                    12 original documents, unchanged
    manifest.yaml            document metadata (section 5.1)
    projects.yaml            project facts (section 5.2)
    counterparties.yaml      counterparty normalisation (section 5.3)
    gold/gold.yaml           human labels and expected outputs (section 5.4)
  backend/
    pyproject.toml
    app/
      __init__.py
      config.py
      models.py
      loaders.py
      llm.py
      extract.py
      identity.py
      rules.py
      crossproject.py
      boardcheck.py
      status.py
      evaluate.py
      export.py
      pipeline.py
      api.py
      cli.py
    tests/
      test_rules.py
      test_pipeline_gold.py
      test_no_leakage.py
  cache/
    llm/                     one JSON file per cached LLM call (committed)
  frontend/
    (Vite + React + TypeScript app, section 8)
    public/data/bundle.json  generated by the backend, committed
```

`.gitignore`: `node_modules/`, `frontend/dist/`, `.venv/`, `__pycache__/`, `.pytest_cache/`, `.DS_Store`, `*.pdf`. Do **not** ignore `cache/` or `frontend/public/data/`.

---

## 4. CLAUDE.md (create in Phase 1 with exactly this content)

```markdown
# CLAUDE.md
- Source of truth: PLAN.md. Follow phases in order.
- Python 3.12 via uv. Run backend commands from backend/: `uv run ...`.
- Frontend: Node 22+, Vite, React, TypeScript, Tailwind v4, shadcn/ui. Run from frontend/.
- All LLM calls go through backend/app/llm.py (disk cache in cache/llm). Never call ollama elsewhere.
- Never use a document dated after the as-of date for anything shown at that date.
- British English. User-facing dates as "16 May 2025".
- No new dependencies without a line in DECISIONS.md.
- Commit after every checkpoint.
```

---

## 5. Data files (create in Phase 1, copy exactly)

### 5.1 `data/manifest.yaml`

Document metadata is hand-entered. In a real deployment this is captured when a report is filed. Two dates are assumptions and are marked.

```yaml
documents:
  - id: net-snags
    file: "netherwood commissioning snags 2024.txt"
    project: netherwood
    doc_type: commissioning_summary
    date: 2024-12-31
    date_note: "Document says December 2024, compiled retrospectively. End of month assumed."
    author: null
    title: "Netherwood commissioning snag summary"
    replay_excluded: false
  - id: net-handover
    file: "Netherwood handover pack - status.txt"
    project: netherwood
    doc_type: handover_status
    date: 2025-01-20
    author: null
    title: "Netherwood handover to Operations status"
    replay_excluded: false
  - id: net-lessons
    file: "netherwood_lessons_learned.md"
    project: netherwood
    doc_type: lessons_learned
    date: 2025-02-05
    author: null
    title: "Netherwood lessons learned workshop"
    replay_excluded: false
  - id: dru-transformer
    file: "Drumgarve_transformer_leadtime_Feb2025.txt"
    project: drumgarve
    doc_type: procurement_issue
    date: 2025-02-07
    author: "Procurement"
    title: "Drumgarve transformer lead time issue"
    replay_excluded: false
  - id: ash-wk12
    file: "ASHFIELD_weekly_progress_wk12_2025.txt"
    project: ashfield
    doc_type: weekly_report
    date: 2025-03-21
    author: "J. Patel"
    title: "Ashfield weekly report, week 12"
    replay_excluded: false
  - id: ash-wk19
    file: "ashfield_weekly_wk19.md"
    project: ashfield
    doc_type: weekly_report
    date: 2025-05-16
    author: "J. Patel"
    title: "Ashfield weekly report, week 19"
    replay_excluded: false
  - id: dru-visit
    file: "drumgarve_site_visit_2025-05-30.txt"
    project: drumgarve
    doc_type: site_visit
    date: 2025-05-30
    author: null
    title: "Drumgarve pre-construction site visit"
    replay_excluded: false
  - id: dru-planning
    file: "drumgarve_planning_conditions.md"
    project: drumgarve
    doc_type: planning_status
    date: 2025-06-12
    author: "A. Lindqvist"
    title: "Drumgarve planning condition discharge status"
    replay_excluded: false
  - id: dru-wk24
    file: "drumgarve weekly wk24.txt"
    project: drumgarve
    doc_type: weekly_report
    date: 2025-06-13
    author: "M. Reilly"
    title: "Drumgarve weekly report, week 24"
    replay_excluded: false
  - id: ash-board-jun
    file: "ashfield_monthly_board_update_June.md"
    project: ashfield
    doc_type: board_update
    date: 2025-06-30
    date_note: "Period is June 2025, no issue date given. End of month assumed."
    author: "Project delivery"
    title: "Ashfield board update, June 2025"
    replay_excluded: false
  - id: ash-wk27
    file: "ashfield-weekly-wk27.txt"
    project: ashfield
    doc_type: weekly_report
    date: 2025-07-04
    author: "J. Patel"
    title: "Ashfield weekly report, week 27"
    replay_excluded: false
  - id: ash-dno-corr
    file: "ASH_grid_correspondence_summary.txt"
    project: ashfield
    doc_type: correspondence_summary
    date: 2025-07-10
    author: "J. Patel"
    title: "Ashfield DNO correspondence summary"
    replay_excluded: true
    excluded_reason: "Compiled retrospectively with hindsight. Used only as ground truth, never as replay input."

replay_window:
  start: 2024-12-01
  end: 2025-07-31

ground_truth_events:
  - id: gt-ash-escalation
    project: ashfield
    issue_id: ASH-DNO
    date: 2025-07-03
    label: "Formal escalation to DNO account manager"
    source_doc: ash-dno-corr
```

### 5.2 `data/projects.yaml`

```yaml
projects:
  - id: ashfield
    name: Ashfield
    capacity: "50 MW / 100 MWh"
    pm: "J. Patel"
    baseline_energisation: 2025-11-14
    commercial_date: 2025-12-01
    commercial_label: "Capacity market delivery start"
    phases:
      - { from: 2024-12-01, phase: "Construction" }
      - { from: 2025-05-16, phase: "Commissioning preparation" }
  - id: drumgarve
    name: Drumgarve
    capacity: "40 MW"
    pm: "M. Reilly"
    baseline_energisation: 2025-11-30
    commercial_date: null
    commercial_label: "No capacity market agreement. Winter trading revenue at risk."
    phases:
      - { from: 2024-12-01, phase: "Pre-construction" }
  - id: netherwood
    name: Netherwood
    capacity: null
    pm: null
    baseline_energisation: 2024-09-30
    actual_energisation: 2024-12-09
    commercial_date: null
    commercial_label: "Energised 9 Dec 2024. In operation, handover incomplete."
    phases:
      - { from: 2024-12-01, phase: "Operational, handover open" }
```

### 5.3 `data/counterparties.yaml`

Maps the role the LLM extracts (lower-cased, trimmed) plus project to a counterparty entity. The shared entities are justified by the documents themselves (Drumgarve planning note: "The same contractor was late ... at Netherwood"; Drumgarve procurement note: "second transformer lead time extension from this supplier ... see Netherwood").

```yaml
entities:
  dno:                     { label: "DNO (regional grid company)" }
  civils_contractor_nd:    { label: "Civils contractor (Netherwood, Drumgarve)" }
  transformer_supplier_nd: { label: "Transformer supplier (Netherwood, Drumgarve)" }
  ashfield_contractor:     { label: "Ashfield contractor" }
  lpa_drumgarve:           { label: "Local planning authority (Drumgarve)" }
  landowner_drumgarve:     { label: "Landowner (Drumgarve)" }
  internal:                { label: "Internal" }

rules:   # first match wins; project "*" means any project
  - { roles: ["dno", "distribution network operator", "connections manager", "account manager"], project: "*", entity: dno }
  - { roles: ["civils contractor", "contractor"], project: netherwood, entity: civils_contractor_nd }
  - { roles: ["civils contractor", "contractor"], project: drumgarve, entity: civils_contractor_nd }
  - { roles: ["civils contractor", "contractor"], project: ashfield, entity: ashfield_contractor }
  - { roles: ["transformer supplier", "supplier"], project: netherwood, entity: transformer_supplier_nd }
  - { roles: ["transformer supplier", "supplier"], project: drumgarve, entity: transformer_supplier_nd }
  - { roles: ["lpa", "local planning authority", "local authority"], project: drumgarve, entity: lpa_drumgarve }
  - { roles: ["landowner"], project: drumgarve, entity: landowner_drumgarve }
  - { roles: ["internal", "operations", "procurement", "development"], project: "*", entity: internal }
fallback: "{project}:{role}"   # unknown roles become project-scoped entities
```

### 5.4 `data/gold/gold.yaml`

Human labels. Used for (a) "gold mode", which builds the full bundle without the LLM, as a safety net, and (b) evaluating the LLM pipeline. Alex should skim these once.

Status meanings: `open` unresolved as of that document; `resolved` the document says it is done; `materialised` it has now caused a programme slip or a firm adverse date; `occurred` a past incident recorded for the record or lessons.

```yaml
issues:
  # ---------------- Ashfield ----------------
  - id: ASH-DNO
    project: ashfield
    title: "DNO final connection works date not confirmed"
    category: grid_connection
    counterparty: dno
    mentions:
      - doc: ash-wk12
        status: open
        awaiting_third_party: true
        chase_count: 2
        programme_impact: potential
        triggers:
          - condition: "Not currently on the critical path but will become so if it slips past June"
            deadline: 2025-06-30
      - { doc: ash-wk19, status: open, awaiting_third_party: true, chase_count: null, programme_impact: potential, triggers: [] }
      - { doc: ash-board-jun, status: open, awaiting_third_party: true, chase_count: null, programme_impact: none_stated, triggers: [] }
      - { doc: ash-wk27, status: materialised, awaiting_third_party: false, chase_count: null, programme_impact: realised, triggers: [] }
  - id: ASH-WEATHER
    project: ashfield
    title: "Weather delay to plinth 5-6 foundation pours"
    category: weather
    counterparty: null
    mentions:
      - { doc: ash-wk12, status: open, awaiting_third_party: false, chase_count: null, programme_impact: potential, triggers: [] }
      - { doc: ash-wk19, status: resolved, awaiting_third_party: false, chase_count: null, programme_impact: none_stated, triggers: [] }
  - id: ASH-CRANE
    project: ashfield
    title: "Second crane visit needed due to access road width"
    category: site_access
    counterparty: ashfield_contractor
    mentions:
      - { doc: ash-wk19, status: occurred, awaiting_third_party: false, chase_count: null, programme_impact: none_stated, triggers: [] }
  - id: ASH-SNAG
    project: ashfield
    title: "Switchroom cable entry snagging outstanding"
    category: commissioning
    counterparty: ashfield_contractor
    mentions:
      - { doc: ash-wk19, status: open, awaiting_third_party: true, chase_count: null, programme_impact: none_stated, triggers: [] }

  # ---------------- Drumgarve ----------------
  - id: DRU-TRANSFORMER
    project: drumgarve
    title: "Main transformer lead time extended from 38 to 54 weeks"
    category: procurement_supplier
    counterparty: transformer_supplier_nd
    mentions:
      - { doc: dru-transformer, status: materialised, awaiting_third_party: false, chase_count: null, programme_impact: realised, triggers: [] }
      - { doc: dru-wk24, status: materialised, awaiting_third_party: false, chase_count: null, programme_impact: realised, triggers: [] }
  - id: DRU-COND14
    project: drumgarve
    title: "Swept path analysis for traffic condition not provided"
    category: planning
    counterparty: civils_contractor_nd
    mentions:
      - { doc: dru-visit, status: open, awaiting_third_party: true, chase_count: 1, programme_impact: none_stated, triggers: [] }
      - doc: dru-planning
        status: open
        awaiting_third_party: true
        chase_count: 3
        programme_impact: potential
        triggers:
          - condition: "If the contractor does not provide the analysis within two weeks that date is at risk"
            deadline: 2025-06-26
      - doc: dru-wk24
        status: open
        awaiting_third_party: true
        chase_count: 4
        programme_impact: potential
        triggers:
          - condition: "That will change if the transformer date improves or if conditions remain outstanding into the autumn"
            deadline: 2025-09-01
  - id: DRU-COND9
    project: drumgarve
    title: "Landscaping condition overdue for determination"
    category: planning
    counterparty: lpa_drumgarve
    mentions:
      - { doc: dru-planning, status: open, awaiting_third_party: true, chase_count: null, programme_impact: none_stated, triggers: [] }
      - doc: dru-wk24
        status: open
        awaiting_third_party: true
        chase_count: null
        programme_impact: potential
        triggers:
          - condition: "That will change if the transformer date improves or if conditions remain outstanding into the autumn"
            deadline: 2025-09-01
  - id: DRU-ACCESS
    project: drumgarve
    title: "Access track pinch points too narrow for container delivery"
    category: site_access
    counterparty: civils_contractor_nd
    mentions:
      - { doc: dru-visit, status: open, awaiting_third_party: false, chase_count: null, programme_impact: potential, triggers: [] }
      - { doc: dru-wk24, status: open, awaiting_third_party: false, chase_count: null, programme_impact: potential, triggers: [] }
  - id: DRU-DRAINAGE
    project: drumgarve
    title: "Standing water not flagged by ground investigation"
    category: ground_conditions
    counterparty: null
    mentions:
      - { doc: dru-visit, status: open, awaiting_third_party: false, chase_count: null, programme_impact: none_stated, triggers: [] }
  - id: DRU-HEDGEROW
    project: drumgarve
    title: "Hedgerow nesting season constraint not assessed"
    category: environmental
    counterparty: landowner_drumgarve
    mentions:
      - { doc: dru-visit, status: open, awaiting_third_party: false, chase_count: null, programme_impact: potential, triggers: [] }
      - { doc: dru-wk24, status: open, awaiting_third_party: false, chase_count: null, programme_impact: potential, triggers: [] }

  # ---------------- Netherwood ----------------
  - id: NET-PLANNING
    project: netherwood
    title: "Planning condition discharge delayed by civils contractor"
    category: planning
    counterparty: civils_contractor_nd
    mentions:
      - { doc: net-snags, status: occurred, awaiting_third_party: false, chase_count: null, programme_impact: realised, triggers: [] }
      - { doc: net-lessons, status: occurred, awaiting_third_party: false, chase_count: null, programme_impact: realised, triggers: [] }
  - id: NET-TRANSFORMER
    project: netherwood
    title: "Transformer delivery late after supplier revised lead time"
    category: procurement_supplier
    counterparty: transformer_supplier_nd
    mentions:
      - { doc: net-snags, status: occurred, awaiting_third_party: false, chase_count: null, programme_impact: realised, triggers: [] }
      - { doc: net-lessons, status: occurred, awaiting_third_party: false, chase_count: null, programme_impact: realised, triggers: [] }
  - id: NET-FIRMWARE
    project: netherwood
    title: "PCS firmware inconsistent across units, missed at handover"
    category: commissioning
    counterparty: internal
    mentions:
      - { doc: net-snags, status: occurred, awaiting_third_party: false, chase_count: null, programme_impact: none_stated, triggers: [] }
      - { doc: net-handover, status: open, awaiting_third_party: false, chase_count: null, programme_impact: none_stated, triggers: [] }
  - id: NET-HANDOVER
    project: netherwood
    title: "Handover to Operations incomplete"
    category: handover
    counterparty: internal
    mentions:
      - { doc: net-handover, status: open, awaiting_third_party: false, chase_count: null, programme_impact: none_stated, triggers: [] }
      - { doc: net-lessons, status: open, awaiting_third_party: false, chase_count: null, programme_impact: none_stated, triggers: [] }

expected_cross_project_matches:
  - { issue: DRU-TRANSFORMER, prior: NET-TRANSFORMER, min_confidence: high }
  - { issue: DRU-COND14, prior: NET-PLANNING, min_confidence: high }
  - { issue: DRU-ACCESS, prior: ASH-CRANE, min_confidence: medium }
expected_no_cross_project_match: [DRU-DRAINAGE, DRU-HEDGEROW, ASH-DNO, ASH-WEATHER]

board_check:
  doc: ash-board-jun
  claims:   # verdicts expected when evaluated using documents up to 2025-06-30
    - { text: "Construction complete.", verdict: supported_with_caveat }
    - { text: "Energisation forecast 14/11/2025, in line with baseline.", verdict: supported_with_caveat }
    - { text: "Capacity market delivery start 01/12/2025.", verdict: no_evidence }
    - { text: "DNO connection works date not yet confirmed.", verdict: supported }
    - { text: "Low risk, expected to be confirmed shortly.", verdict: contradicted }
    - { text: "On programme, slightly over budget.", verdict: supported_with_caveat }
    - { text: "No material concerns.", verdict: contradicted }
  gold_reasons:
    "Low risk, expected to be confirmed shortly.": "Open since 21 Mar with repeated unanswered chases and only a verbal 'late summer'. Float fell from 11 to 4 days."
    "No material concerns.": "An open grid dependency with no written date and 4 days of float is a material concern."
    "Construction complete.": "Civils complete and containers positioned by 16 May, but switchroom snagging still outstanding."
    "Energisation forecast 14/11/2025, in line with baseline.": "Forecast matches baseline, but float had fallen to 4 days by 16 May."
    "On programme, slightly over budget.": "Forecast on baseline but with almost no float left."
    "DNO connection works date not yet confirmed.": "Consistent with weekly reports."
    "Capacity market delivery start 01/12/2025.": "No earlier document in the sample states this date."
```

---

## 6. Backend specification

### 6.1 Setup

```bash
cd backend
uv init --app --python 3.12 .
uv add fastapi "uvicorn[standard]" "pydantic>=2" ollama pyyaml numpy rapidfuzz typer python-dateutil
uv add --dev pytest
```

### 6.2 `config.py`

```python
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"
DOCS = DATA / "docs"
CACHE = ROOT / "cache" / "llm"
BUNDLE_OUT = ROOT / "frontend" / "public" / "data" / "bundle.json"

LLM_MODEL = "qwen3:8b"
EMBED_MODEL = "nomic-embed-text"
PROMPT_VERSION = "v1"
LLM_OPTIONS = {"temperature": 0, "seed": 42, "num_ctx": 8192}

IDENTITY_COS_MIN = 0.55          # below this, never the same issue
XP_SHOW_MIN = 0.60               # cross-project score to show a match
XP_HIGH = 0.80                   # high confidence threshold
TRIGGER_STAGES_DAYS = [56, 28, 0]
TRIGGER_STAGE_SEVERITY = {56: "amber", 28: "red", 0: "red"}
PERSISTENCE_AMBER = 2
PERSISTENCE_RED = 3
PERSISTENCE_DOC_TYPES = {"weekly_report", "site_visit", "planning_status", "procurement_issue",
                         "handover_status", "commissioning_summary"}
# board_update, lessons_learned, correspondence_summary never count towards persistence:
# they summarise other documents and are not independent evidence.
```

### 6.3 `models.py` (Pydantic)

LLM-facing schemas use `str` for dates (small models handle them better); convert and validate in code.

```python
Category = Literal["grid_connection", "planning", "procurement_supplier", "contractor_performance",
                   "site_access", "ground_conditions", "environmental", "weather",
                   "commissioning", "handover", "cost", "other"]
Status = Literal["open", "resolved", "materialised", "occurred"]
Impact = Literal["none_stated", "potential", "realised"]

class LLMTrigger(BaseModel):
    condition_text: str
    deadline_date: str | None        # ISO yyyy-mm-dd or null

class LLMMention(BaseModel):
    title: str                       # max 10 words
    description: str                 # 1-2 sentences
    category: Category
    counterparty_role: str | None
    status: Status
    awaiting_third_party: bool
    chase_count: int | None
    programme_impact: Impact
    triggers: list[LLMTrigger]
    evidence_quote: str

class LLMProgramme(BaseModel):
    baseline_energisation: str | None
    forecast_energisation: str | None
    float_days: int | None

class LLMExtraction(BaseModel):
    mentions: list[LLMMention]
    programme: LLMProgramme | None
```

Internal models (dataclasses or Pydantic, your choice): `Document`, `Mention` (adds `id`, `doc_id`, `date`, `counterparty` entity id, `quote_span: tuple[int,int] | None`, `triggers` with real dates), `Issue` (`id`, `project`, `title`, `description`, `category`, `counterparty`, `first_seen`, `mentions`), `Trigger` (`id`, `issue_id`, `declared_doc_id`, `declared_on`, `condition_text`, `deadline`), `Alert`, `Match`, `BoardCheck`. Field names must match the bundle schema in section 7.

### 6.4 `llm.py`

- `chat_json(system: str, user: str, schema: type[BaseModel], tag: str) -> BaseModel`
  - Cache key: sha256 of `LLM_MODEL + PROMPT_VERSION + tag + system + user`. File: `cache/llm/{tag}-{key[:16]}.json` containing `{"request": {...}, "response": {...}}`.
  - On miss: `ollama.chat(model=LLM_MODEL, messages=[...], format=schema.model_json_schema(), options=LLM_OPTIONS, think=False)`. If the installed `ollama` library rejects `think`, call without it and strip any `<think>...</think>` block from the content.
  - Validate with `schema.model_validate_json`. On failure retry up to 2 times, appending the validation error to the user message. After 3 failures raise `LLMFailure`.
- `embed(texts: list[str]) -> np.ndarray` using `ollama.embed(model=EMBED_MODEL, input=["clustering: " + t for t in texts])`, cached the same way (tag `embed`), L2-normalised.
- A module-level flag `OFFLINE = os.getenv("EW_OFFLINE") == "1"`: when set, a cache miss raises instead of calling Ollama. Used for CI-style rebuilds on machines without Ollama.

### 6.5 `extract.py`

`extract_document(doc) -> list[Mention], ProgrammeSnapshot | None`

System prompt (use verbatim, `{doc_date}` filled in):

```
You extract project issues from documents about building grid-scale battery storage sites.
Return JSON that matches the schema exactly.

Definitions and rules:
- An issue is a risk, problem, delay, unanswered dependency, constraint or past incident that affects or could affect programme, cost or handover. Work that is simply complete is not an issue.
- Return one mention per distinct issue in this document. Do not merge unrelated issues. Do not split one issue into several.
- title: at most 10 words, neutral wording, no project name.
- description: one or two plain sentences.
- counterparty_role: who the issue depends on or was caused by. Use one of: DNO, civils contractor, contractor, transformer supplier, LPA, landowner, internal. Use null if none is clear.
- status: open = unresolved as of this document; resolved = the document says it is done or closed; materialised = it has now caused a programme slip or a confirmed adverse date; occurred = a past incident described for the record or as a lesson.
- awaiting_third_party: true if the team is waiting on a response or deliverable from someone outside the project team.
- chase_count: the number of chases or requests the document states for this issue, otherwise null.
- programme_impact: realised if a slip has happened, potential if the document says it could affect the programme, otherwise none_stated.
- triggers: only when the document states a condition or deadline after which the issue becomes critical or the programme is at risk. condition_text must be copied from the document. Resolve deadline_date to yyyy-mm-dd using the document date {doc_date}: a month name means the last day of that month; "within N weeks" means the document date plus N weeks; "autumn" means 1 September of that year. If it cannot be resolved, use null.
- evidence_quote: copy an exact, contiguous piece of the document text, at most 200 characters, that supports the mention. Do not paraphrase.
- programme: fill only values the document states. Dates as yyyy-mm-dd. Use null otherwise.
```

User message: `Document date: {date}\nProject: {project}\nDocument type: {doc_type}\n\n---\n{full text}\n---`

Post-processing in code:
1. Quote check: normalise whitespace on both sides; if exact substring, store `quote_span`. Else `rapidfuzz.fuzz.partial_ratio >= 90` → locate best window and store it. Else keep the quote text, set `quote_span = None`, `quote_valid = False`.
2. Trigger dates: parse ISO; drop the date (keep condition) if unparseable or earlier than the document date.
3. Counterparty: map `(project, counterparty_role.lower().strip())` via `counterparties.yaml`.
4. Title: truncate to 10 words if longer.

`--source gold` path: build the same `Mention` objects directly from `gold.yaml` (title, category, counterparty from the issue; mention fields from the mention; quote = null). Gold mode must produce a complete bundle with no Ollama calls.

### 6.6 `identity.py` (same issue across documents, within a project)

`assign(mention, open_issues_in_project_before_this_doc) -> Issue` (existing or new)

1. Candidates: issues in the same project whose latest status is not `resolved`.
2. Score each with cosine similarity of embeddings of `title + ". " + description`.
3. Drop candidates below `IDENTITY_COS_MIN`. Sort the rest by score, keep the top 3.
4. For each candidate in order, ask the judge (below). First `same: true` wins. Otherwise create a new issue.
5. A mention can attach to at most one issue; an issue can receive at most one mention per document (if two mentions in one doc pick the same issue, the higher-scoring one wins and the other creates a new issue).

Judge prompt (tag `identity`):

```
Two issue records from the same construction project. Decide whether they describe the same underlying issue: the same problem or dependency, possibly worded differently or at a later stage (for example an unconfirmed date that is later confirmed late is the same issue).
Return JSON {"same": true|false, "reason": "<at most 20 words>"}.

Earlier issue (first seen {date}): {title}. {description}
New mention ({date}): {title}. {description}
```

New issue IDs: `{PROJECT_PREFIX}-{n:03d}` in LLM mode (ASH, DRU, NET). In gold mode use gold IDs. For evaluation, map LLM issues to gold issues by majority vote of their mentions' gold labels (section 6.10).

### 6.7 `pipeline.py` (chronological processing, the leakage guard)

```
docs = manifest documents with replay_excluded == false, sorted by (date, id)
issues = {}
for doc in docs:
    mentions, programme = extract(doc)          # or gold
    for m in mentions:
        issue = identity.assign(m, open issues in doc.project as known BEFORE this doc)
        attach m to issue; register m.triggers on issue
    store programme snapshot
alerts = rules.compute(issues, window)           # section 6.8
matches = crossproject.compute(issues)           # section 6.9
status = status.compute(issues, alerts, snapshots, window)
board = boardcheck.run(board docs, using only evidence dated <= board doc date)
bundle = export.build(...)
```

`replay_excluded` documents are never extracted into issues. They appear in the Sources list and the correspondence summary feeds `ground_truth_events` only.

### 6.8 `rules.py` (deterministic, no LLM)

Issue status on date `d` = status of its latest mention dated `<= d`. An alert is **active** on `d` if `fired_on <= d` and the issue status on `d` is not `resolved`.

**R1 PERSISTENCE.** For each issue, take its mentions from documents whose `doc_type` is in `PERSISTENCE_DOC_TYPES`, sorted by date. Walk them keeping a streak of consecutive `open` mentions (any other status resets it to 0). When the streak reaches 2, fire amber on that mention's date; when it reaches 3, fire red. Each level fires at most once per issue.
- Explanation template: `"Raised in {n} documents in a row since {first_date} and still open."` plus, if any mention has `awaiting_third_party`, `" Waiting on {counterparty label}."` plus, if the latest chase_count is set, `" {k} chases recorded."`

**R2 TRIGGER (staged, in advance).** For each trigger with deadline `D` declared on `d0`:
- For each stage `s` in `[56, 28, 0]`: `fire = D - s days`.
- Stages with `fire < d0` are already past at declaration. Of those, fire only the most urgent one (smallest `s`), on `d0`. Fire all later stages on their date.
- Do not fire a stage if the issue status on the fire date is `resolved` or `materialised`.
- Severity from `TRIGGER_STAGE_SEVERITY`.
- Explanation template: `"On {d0} the report said: \"{condition_text}\". That point is {days_left} days away ({D}) and the issue is still open."` For stage 0: `"The deadline set in the report on {d0} ({D}) has been reached and the issue is still open."`

**R3 IMPACT.** When a mention has `status == materialised` or `programme_impact == realised` and the issue is not historical (status not `occurred`), fire red on that mention's date, once per issue. Explanation: `"This issue has now affected the programme ({doc title}, {date})."`

**R4 PRIOR INCIDENT.** For each cross-project match shown (section 6.9), fire `info` on the issue's `first_seen` date. Explanation: `"Similar to {prior title} at {prior project} ({prior first_seen}). {match explanation}"`

Alert IDs: `ALR-{issue_id}-{rule}-{stage or level}`. Alert explanations are generated by these templates, never by the LLM, so every alert is reproducible and auditable.

### 6.9 `crossproject.py`

For each issue `I`, candidates are issues `P` in **other projects** with `P.first_seen < I.first_seen` (leakage guard).

```
score = 0.5 * cosine(I, P)
      + 0.3 * category_score      # 1.0 same category; 0.5 if both in {planning, contractor_performance}; else 0
      + 0.2 * (1.0 if same counterparty entity and entity is not "internal" or null else 0)
```

Keep candidates with `score >= XP_SHOW_MIN`, at most 2 per issue. Confidence: `high` if `>= XP_HIGH`, else `medium`. Store `reasons` as a list of human strings from the components that contributed (e.g. `"Same counterparty: Civils contractor (Netherwood, Drumgarve)"`, `"Same category: site access"`, `"Similar wording"`).

Explanation via LLM (tag `xp_explain`, gold mode uses a template: `"{prior title} at {prior project}."`):

```
An earlier incident on another project may be relevant to a new issue.
Write one plain sentence (at most 30 words) saying why it is relevant and what happened last time, using only the facts given. No speculation.
Return JSON {"explanation": "..."}.

New issue ({project}, {date}): {title}. {description}
Earlier incident ({project}, {date}): {title}. {description} Outcome recorded: {latest mention description}
```

### 6.10 `boardcheck.py`

1. Claims are split deterministically, not by the LLM: take the board document's `## Headline`, `## Risks` and `## Outlook` sections; split bullets and sentences on `. `; drop fragments under 3 words (this drops "Weather"). Record each claim's character span in the document.
2. Budget check, deterministic: from `## Budget`, parse each `- label (£Nk)` line and the stated total `£0.4m`. Output items, stated total, computed total, whether they match, the largest item and its share of the total, and `flag_vague = True` if the largest item's label contains "various", "misc" or "other" and its share is above 50%. Expected: total matches (£400k), largest item "Contingency drawdown, various", share 77%, flagged.
3. Evidence pack for the board doc's project, using only documents dated on or before the board doc: every issue with its mentions (date, doc title, status, chase_count, quote), alerts active on that date, and all programme snapshots (baseline, forecast, float).
4. Per claim (tag `board_claim`):

```
You check a statement from a board update against the project evidence held on the same date.
Verdicts:
- supported: the evidence backs the statement.
- supported_with_caveat: broadly true, but the evidence shows something the reader should know.
- contradicted: the evidence shows the statement understates a risk or is wrong.
- no_evidence: the evidence does not cover this statement.
Return JSON {"verdict": "...", "reason": "<at most 30 words, plain English>", "evidence_mention_ids": ["..."]}.

Statement: "{claim}"
Evidence (as of {date}):
{evidence pack as compact text, each mention prefixed with its id}
```

In gold mode use `gold.yaml` verdicts and `gold_reasons`. In LLM mode, if the claim "Low risk, expected to be confirmed shortly." is not `contradicted`, adjust the prompt wording once (bump `PROMPT_VERSION` to `v1b` for this tag only) and retry; if still wrong, use the gold verdict for that claim and record `fallback: true` on it and a line in `DECISIONS.md`. Be honest about this in the Evaluation page.

### 6.11 `status.py`

For every day in the replay window, compute per project:
- `evidence_status`: `at_risk` if any active red alert; `watch` if any active amber alert; else `on_track`. `reasons` = the active alert IDs driving it.
- `reported_status`: from the latest document dated `<= d` of type `weekly_report` or `board_update` that has a programme statement. `in_delay` if forecast is after baseline or the text says "in delay"; otherwise `on_programme`. Keep the source doc ID and a short source quote. Board update counts (its headline says "in line with baseline").
- `divergent`: reported `on_programme` while evidence is `at_risk`.

Export only change points (`{date, ...}` whenever any field changes). Netherwood has no weekly reports, so its reported status is `null` ("No status report in sample").

### 6.12 `evaluate.py` (LLM mode vs gold)

- Mention matching per document: pair each gold mention with the extracted mention in the same document with highest cosine similarity of titles, greedy, threshold 0.60.
- Metrics: mention recall, mention precision, category accuracy (on pairs), status accuracy (on pairs), trigger deadline exact-match rate, quote validity rate.
- Identity: pairwise precision and recall over all pairs of matched mentions within a project (same issue vs not), compared with gold.
- Cross-project: which expected matches were found (by mapping LLM issues to gold IDs by majority of their mentions), and any shown match involving `expected_no_cross_project_match` issues (false positives).
- Lead time table for `ASH-DNO` (or its mapped LLM issue): first alert date, first red date, first persistence alert date, each vs ground truth `2025-07-03`, in days.
- Fallbacks used (documents or claims that fell back to gold).

In gold mode, `evaluation` holds only the lead-time table and `source: gold`.

### 6.13 `export.py` and `api.py`

`export.build()` writes `frontend/public/data/bundle.json` (pretty-printed, keys sorted, stable order so diffs are readable).

`api.py` (FastAPI, kept thin on purpose: in a real system this is where new reports would be posted):
- `GET /api/health` → `{"ok": true, "model": LLM_MODEL}`
- `GET /api/bundle` → the bundle JSON
- `POST /api/rebuild?source=llm|gold` → reruns the pipeline (from cache) and returns the evaluation block
- CORS allow `http://localhost:5173`

### 6.14 `cli.py` (Typer)

```
uv run python -m app.cli extract [--source llm|gold] [--refresh]   # extraction only, fills cache
uv run python -m app.cli build   [--source llm|gold]               # full pipeline -> bundle.json
uv run python -m app.cli eval                                      # prints evaluation table
uv run python -m app.cli all     [--source llm|gold]               # extract + build + eval
uv run uvicorn app.api:app --reload --port 8000
```

Default `--source llm`. `--refresh` ignores cache for extraction only.

### 6.15 Tests

`test_rules.py` (unit, synthetic issues):
- Persistence: open, open → amber on second date; open, open, open → red on third; open, resolved, open → no alert; board_update mentions ignored.
- Trigger staging: declared 2025-03-21, deadline 2025-06-30 → fires 2025-05-05 (amber), 2025-06-02 (red), 2025-06-30 (red). Declared 2025-06-12, deadline 2025-06-26 → fires the 28-day stage on 2025-06-12 (red), and 2025-06-26 (red); no 56-day alert. Issue resolved before a stage → that stage does not fire.
- Impact fires once.

`test_pipeline_gold.py` (runs `build --source gold`, asserts on the bundle):
- ASH-DNO alerts, exactly, ordered by date:
  - 2025-05-05 TRIGGER amber (56)
  - 2025-05-16 PERSISTENCE amber
  - 2025-06-02 TRIGGER red (28)
  - 2025-06-30 TRIGGER red (0)
  - 2025-07-04 IMPACT red
- DRU-COND14 alerts include: 2025-05-30 PRIOR_INCIDENT info; 2025-06-12 PERSISTENCE amber; 2025-06-12 TRIGGER red (28); 2025-06-13 PERSISTENCE red; 2025-06-26 TRIGGER red (0); 2025-07-07 TRIGGER amber (56, autumn trigger).
- DRU-TRANSFORMER: 2025-02-07 IMPACT red and 2025-02-07 PRIOR_INCIDENT info.
- The 3 expected cross-project matches exist with the expected minimum confidence; none for the `expected_no_cross_project_match` issues.
- Ashfield on 2025-06-30: evidence `at_risk`, reported `on_programme`, `divergent: true`. On 2025-07-04: reported `in_delay`.
- Ashfield on 2025-03-21: evidence `on_track`.
- Board check: "Low risk, expected to be confirmed shortly." is `contradicted`; budget check `flag_vague: true`, share between 0.77 and 0.78.
- Lead times vs 2025-07-03: first alert 59 days earlier, first red 31 days earlier, first persistence alert 48 days earlier.

`test_no_leakage.py` (gold and, if the cache exists, LLM bundle):
- For each alert, every mention used to compute it is dated `<= fired_on` (record the mention IDs used on each alert internally so this can be tested).
- No mention, issue or alert references `ash-dno-corr`.
- For every match, `prior.first_seen < issue.first_seen`.
- For the board check, every `evidence_mention_ids` entry is dated `<= 2025-06-30`.

---

## 7. Bundle schema (`frontend/public/data/bundle.json`)

Mirror this exactly in `frontend/src/types.ts`.

```ts
type ISODate = string; // "2025-05-16"

interface Bundle {
  meta: { generated_at: string; source: "llm" | "gold"; model: string; embed_model: string;
          prompt_version: string; window: { start: ISODate; end: ISODate } };
  projects: { id: string; name: string; capacity: string | null; pm: string | null;
              baseline_energisation: ISODate; actual_energisation?: ISODate | null;
              commercial_date: ISODate | null; commercial_label: string;
              phases: { from: ISODate; phase: string }[] }[];
  counterparties: Record<string, { label: string }>;
  documents: { id: string; project: string; doc_type: string; date: ISODate; date_note?: string;
               author: string | null; title: string; file: string; text: string;
               replay_excluded: boolean; excluded_reason?: string }[];
  issues: { id: string; project: string; title: string; description: string; category: string;
            counterparty: string | null; first_seen: ISODate;
            mentions: { id: string; doc_id: string; date: ISODate; status: string;
                        awaiting_third_party: boolean; chase_count: number | null;
                        programme_impact: string; description: string;
                        evidence_quote: string | null; quote_span: [number, number] | null;
                        quote_valid: boolean }[];
            gold_id?: string }[];
  triggers: { id: string; issue_id: string; declared_doc_id: string; declared_on: ISODate;
              condition_text: string; deadline: ISODate | null }[];
  alerts: { id: string; issue_id: string; project: string;
            rule: "PERSISTENCE" | "TRIGGER" | "IMPACT" | "PRIOR_INCIDENT";
            severity: "info" | "amber" | "red"; fired_on: ISODate; title: string;
            explanation: string; stage_days?: number }[];
  matches: { id: string; issue_id: string; prior_issue_id: string; score: number;
             confidence: "high" | "medium"; reasons: string[]; explanation: string }[];
  programme_snapshots: { project: string; doc_id: string; date: ISODate;
                         baseline: ISODate | null; forecast: ISODate | null; float_days: number | null }[];
  status_timeline: { project: string; date: ISODate;
                     evidence_status: "on_track" | "watch" | "at_risk"; evidence_reasons: string[];
                     reported_status: "on_programme" | "in_delay" | null;
                     reported_source_doc: string | null; reported_quote: string | null;
                     divergent: boolean }[];
  board_checks: { doc_id: string; as_of: ISODate;
                  claims: { id: string; text: string; span: [number, number]; section: string;
                            verdict: "supported" | "supported_with_caveat" | "contradicted" | "no_evidence";
                            reason: string; evidence_mention_ids: string[]; fallback?: boolean }[];
                  budget: { items: { label: string; amount: number }[]; stated_total: number;
                            computed_total: number; matches: boolean; largest_label: string;
                            largest_share: number; flag_vague: boolean } }[];
  ground_truth_events: { id: string; project: string; issue_id: string; date: ISODate;
                         label: string; source_doc: string }[];
  evaluation: { source: "llm" | "gold";
                extraction?: { mention_recall: number; mention_precision: number; category_accuracy: number;
                               status_accuracy: number; trigger_date_accuracy: number; quote_validity: number };
                identity?: { pairwise_precision: number; pairwise_recall: number };
                cross_project?: { expected: number; found: number; false_positives: number;
                                  detail: { issue: string; prior: string; found: boolean }[] };
                lead_time: { issue_id: string; ground_truth_date: ISODate;
                             rows: { label: string; date: ISODate | null; days_earlier: number | null }[] };
                fallbacks: string[] };
}
```

`ground_truth_events[].issue_id` must point at the bundle's issue ID for ASH-DNO (in LLM mode, the issue mapped to gold `ASH-DNO`).

---

## 8. Frontend specification

### 8.1 Setup

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install -D tailwindcss @tailwindcss/vite
npm install react-router-dom zustand date-fns lucide-react clsx
npx shadcn@latest init        # follow prompts; set up the @/ path alias in tsconfig and vite.config
npx shadcn@latest add button badge tabs tooltip sheet table select toggle separator
```

- Router: `HashRouter` (works on any static host with no rewrites).
- Data: load once from `` `${import.meta.env.BASE_URL}data/bundle.json` `` into a Zustand store. All views derive from `bundle` + `asOf`.
- Write selectors in `src/lib/selectors.ts`, all taking `asOf`: `docsUpTo`, `issueStatusOn`, `activeAlertsOn`, `alertsFiredOn`, `statusOn(project)`, `mentionsUpTo(issue)`, `matchesFor(issue)` (only if both issues have `first_seen <= asOf`). Nothing in the UI may show data dated after `asOf`, except the ground-truth marker when its toggle is on and its date is `<= asOf`.

### 8.2 Design direction (read before invoking the Taste skill)

Use the `taste-skill:design-taste-frontend` skill, on its **dashboard / app screen** route. The constraints below override anything the skill suggests.

**What this is.** A practical internal tool for project managers and a delivery director. It is not selling anything. No hero sections, no marketing copy, no illustrations, no photographs, no stock images, no image search, no gradients on surfaces, no decorative animation. Calm, dense, legible, trustworthy. If the skill offers several app styles, pick the quietest one.

**Brand colours** (sampled from Statera's logo; navy base, blue to teal gradient):

```css
--navy-900: #0F1F34;   /* app shell: top bar and sidebar */
--navy-800: #172B45;   /* sidebar hover / selected */
--navy-600: #3A4E69;   /* secondary text on light */
--blue-500: #1AA3E8;   /* primary actions, links, focus rings, selected states */
--blue-600: #0E7FC0;   /* primary hover; blue text on white (passes contrast) */
--teal-400: #12D3A6;   /* brand accent only: the 2px gradient rule under the top bar and the active nav marker */
--gradient-brand: linear-gradient(90deg, #00B2F0 0%, #12D3A6 100%); /* only for that 2px rule */
--bg: #F4F6F9;         /* page background */
--surface: #FFFFFF;    /* panels */
--border: #E2E7EE;
--text: #0F1F34;
--text-muted: #5B6B82;
```

**Status colours** are separate from brand colours and always paired with a text label and an icon, never colour alone:

```css
--red:   #C8372D;  /* at risk / red alert   icon: AlertOctagon */
--amber: #B7791F;  /* watch / amber alert   icon: AlertTriangle */
--green: #2F7D57;  /* on track              icon: CheckCircle2 */
--info:  #0E7FC0;  /* info / seen before    icon: History */
```

Use 10% tints of these for pill backgrounds.

**Project colours** (timeline ticks, small dots only): Ashfield `#1AA3E8`, Drumgarve `#12B892`, Netherwood `#7A8BA6`.

**Type.** Montserrat (Google Fonts, 600 and 700) for page titles and small uppercase labels with wide letter-spacing (echoes the brand's tracked capitals). Inter (400, 500, 600) for everything else. `font-variant-numeric: tabular-nums` on all dates and numbers. Base size 14px; never below 12px.

**Do not recreate the Statera logo.** The top bar shows the text "Early Warning" in Montserrat 600 and a small uppercase label "PROJECT DELIVERY" in `--blue-500`.

**Layout rules.**
- No page scroll and no endless scroll. The app shell is `h-dvh overflow-hidden`. Every view must fit at **1280 × 720** (projector) and look right at 1920 × 1080 and 1440 × 900.
- Lists longer than the space available are **paginated** (page size stated per view), never infinitely scrolled. The only element allowed to scroll internally is the document text inside the source drawer.
- Master-detail and tabs instead of stacked sections.
- One primary action per view at most.
- Below 1024px wide, show a simple message: "Best viewed on a larger screen." No mobile layout is needed.

**Copy.** Plain British English, sentence case, no exclamation marks, no emoji. Say what the system saw, not what it "thinks". Dates as `16 May 2025`. Ages as "open 8 weeks". Every alert shows its rule in plain words ("Raised in 2 reports in a row", "Deadline set in the report", "Programme affected", "Seen before on another project").

### 8.3 App shell

- **Top bar** (56px, `--navy-900`): left, product name and label. Right, a quiet badge `Cached run · qwen3:8b` (or `Gold labels` when `meta.source == "gold"`) with a tooltip showing `generated_at` and `prompt_version`, and a `?` button opening a keyboard shortcuts popover. A 2px `--gradient-brand` rule along the bottom edge.
- **Replay bar** (72px, white, below the top bar, always visible):
  - Left: "As of" label and the date in large Montserrat (`16 May 2025`).
  - Buttons: previous document, play/pause, next document. Play steps to the next document every 2.5 seconds.
  - Centre: a horizontal track for the replay window with month labels, one tick per non-excluded document coloured by project (hover shows document title), and small markers for alert fire dates (red/amber). A draggable handle sets `asOf` to any day.
  - Right: "Jump to" select with presets: `Ashfield first raises DNO date (21 Mar 2025)`, `First warning (5 May 2025)`, `Drumgarve site visit (30 May 2025)`, `Ashfield board paper (30 Jun 2025)`, `Ashfield slip reported (4 Jul 2025)`. And a toggle "Show what actually happened" (shows ground-truth markers).
- **Sidebar** (220px, `--navy-900`): Portfolio, Ashfield, Drumgarve, Netherwood, Alerts, Board check, Evaluation, Sources. Each project item shows a small evidence status dot for the current `asOf`. Alerts shows a count of alerts fired in the last 14 days before `asOf`.
- **Keyboard:** `←`/`→` previous/next document, `Space` play/pause, `G` toggles "show what actually happened", `1` to `8` jump to sidebar items, `Esc` closes drawers.
- Default `asOf` on load: `2025-03-21`.

### 8.4 Views

**Portfolio** (`/`)
- Three project cards in one row.
- Each card: name, capacity, phase on `asOf`, PM. Two status pills side by side: "Reported" (`On programme` / `In delay` / `No status report`) and "Evidence" (`On track` / `Watch` / `At risk`). When `divergent`, a thin red outline on the card and a line: "Reported status and evidence disagree."
- Key dates: baseline energisation, latest forecast (from snapshots), commercial date with "in N days" from `asOf`, or the commercial label.
- Up to 2 active alerts (most severe, then newest), each one line: icon, issue title, rule in plain words, fired date. "View all" goes to the project.
- Footer line: "Open issues: 4 · oldest open 14 weeks".
- Below the cards, a full-width "Latest changes" panel: events (issue first seen, alert fired, issue resolved) dated within 14 days before `asOf`, newest first, max 6, each clickable to the issue.
- Empty state for a project with no documents yet: "No documents for this project as of 1 Feb 2025."

**Project** (`/project/:id`)
- Header row: project name, phase, PM, the two status pills, baseline vs forecast energisation, commercial date.
- Left column (38% width): issue list, page size 8, sorted by active alert severity then age. Row: severity icon, title, "open 8 weeks" or status label, mention count, counterparty label. Filter tabs: Open, All.
- Right column: selected issue detail (first open issue selected by default):
  - Title, category, counterparty, status on `asOf`, first seen, age.
  - **Issue timeline** (the key visual): a horizontal axis from 2 weeks before first mention to `asOf` (or to the trigger deadline if later, greyed beyond `asOf`). Mentions as dots coloured by status, labelled with document short name. Alerts as small flags above the axis. Trigger deadline as a dashed vertical line labelled "Deadline set in report". When the ground-truth toggle is on and the event is `<= asOf`, a navy marker "Actual escalation 3 Jul 2025".
  - Tabs: **Evidence** (one row per mention: date, document, status, quote; clicking opens the source drawer with the quote highlighted), **Alerts** (each with severity, date, plain-English explanation), **Seen before** (cross-project matches: prior issue title and project, confidence pill, reasons as small tags, explanation sentence, and "Relevant" / "Not relevant" buttons; the choice is stored in browser localStorage wrapped in try/catch and shown as a tick; a caption says "Feedback would train the matcher in a full version."), **Triggers** (condition text, declared date, deadline, days remaining).

**Alerts** (`/alerts`)
- Table of alerts fired on or before `asOf`, newest first, page size 10, pagination controls at the bottom of the panel.
- Filters: project, severity, rule.
- Columns: fired, project, issue, rule (plain words), severity pill, explanation (truncated with tooltip). Row click goes to the project view with that issue selected.

**Board check** (`/board`)
- If `asOf` is before the board paper date, show: "The June board paper is dated 30 Jun 2025. Move the date forward to check it." with a button that sets `asOf` to that date.
- Otherwise two panes. Left (55%): the board paper text rendered from markdown, with each claim's span highlighted in its verdict colour tint and a small verdict icon; click selects. Right: selected claim, verdict pill (`Supported`, `Supported, with a caveat`, `Contradicted`, `No evidence`), reason, and evidence items (date, document, quote, click opens drawer). A note: "Checked using documents up to 30 Jun 2025 only." Default selection: the first contradicted claim.
- Under the right pane, a compact budget card: items with amounts, stated vs computed total with a tick, and "Largest item: Contingency drawdown, various (77% of overrun). Label gives no detail." when flagged.
- Any claim with `fallback: true` shows a small "Gold label used" tag.

**Evaluation** (`/evaluation`)
- Title: "How well it worked on the sample". Plain-language intro, one sentence.
- Lead-time card (most prominent): for the Ashfield DNO issue, rows "First warning", "First red alert", "Persistence rule alone", each with date and "N days before the actual escalation (3 Jul 2025)". Caption: "Thresholds are settings. With a 4-week warning instead of 8, the first warning moves to 2 Jun 2025." Compute that sentence from the data, do not hard-code the date.
- Extraction card (LLM mode only): recall, precision, category, status, trigger dates, quotes, each as a percentage with a one-line meaning.
- Matching card: identity pairwise precision and recall; cross-project expected found (e.g. 3 of 3) and false positives.
- Fallbacks list, or "No fallbacks used."
- Run info: source, model, prompt version, generated at.
- Fits one screen as a grid of cards.

**Sources** (`/sources`)
- Table of all 12 documents: date, project, type, title, author, and a tag "Not used in replay" with the reason for the excluded one, and the `date_note` as a tooltip where present. Clicking opens the drawer.

**Source drawer** (shadcn `Sheet`, right side, 520px): document title, date, project, type, then the full text in a monospace-free readable style with the selected quote highlighted (`--blue-500` at 15% tint). The only internally scrolling element in the app.

### 8.5 Quality bar for the UI (check before finishing Phase 6)

- Run the Taste skill's browser check in app mode at 1280 × 720 and 1920 × 1080 and fix its top issues.
- No horizontal or vertical page scroll on any view at 1280 × 720.
- All text meets WCAG AA contrast.
- Every status uses icon + label + colour.
- Focus rings visible for keyboard use.
- Replay walk-through (section 1, demo story) works end to end using only the keyboard.

---

## 9. Phases, timings and checkpoints

Timings assume the human setup in section 2 (about 25 minutes) is done.

### Phase 1: Scaffold and data (15 min)

- Create the layout in section 3, `CLAUDE.md` (section 4), empty `DECISIONS.md`, `.gitignore`.
- Create `data/manifest.yaml`, `projects.yaml`, `counterparties.yaml`, `gold/gold.yaml` exactly as in section 5.
- Set up the backend (6.1) and frontend (8.1) projects. Do not build views yet.
- `loaders.py`: load and validate all four YAML files and all document texts; fail loudly if any manifest file is missing in `data/docs/`.

**CHECKPOINT 1**
```bash
cd backend && uv run python -c "from app.loaders import load_all; d=load_all(); print(len(d.documents), 'docs')"
# expect: 12 docs
cd ../frontend && npm run build
```
Commit: `chore: scaffold repo, data files and project setup`

### Phase 2: LLM wrapper, extraction and gold mode (35 min)

- Implement `config.py`, `models.py`, `llm.py`, `extract.py` (sections 6.2 to 6.5), including gold mode.
- Run `uv run python -m app.cli extract --source llm` **in the background** (it takes several minutes on first run) while continuing with Phase 3.
- Print per document: number of mentions, titles, any `quote_valid: false`, any `LLMFailure`.
- If a document fails 3 times, record it, fall back to gold for that document, and add it to `fallbacks`.

**CHECKPOINT 2**
```bash
cd backend
uv run python -m app.cli extract --source gold      # must work with Ollama stopped
uv run python -m app.cli extract --source llm       # all 11 replay documents processed or fallen back
ls ../cache/llm | wc -l                             # cache files exist
```
Report: mentions per document vs gold counts.
Commit: `feat: document extraction with local LLM, disk cache and gold mode`

### Phase 3: Identity, rules, status and pipeline (40 min)

- Implement `identity.py`, `rules.py`, `status.py`, `pipeline.py` (6.6 to 6.8, 6.11) and the CLI `build` command with a minimal `export.py` (everything except board checks, matches and evaluation, which can be empty lists for now).
- Write `test_rules.py` and the parts of `test_pipeline_gold.py` that cover alerts and status.

**CHECKPOINT 3**
```bash
cd backend
uv run pytest tests/test_rules.py -q
uv run python -m app.cli build --source gold
uv run pytest tests/test_pipeline_gold.py -q -k "alerts or status"
```
The ASH-DNO alert list must match section 6.15 exactly.
Commit: `feat: issue tracking, alert rules, status timeline and replay pipeline`

### Phase 4: Cross-project matching and board check (25 min)

- Implement `crossproject.py` and `boardcheck.py` (6.9, 6.10). Add R4 to rules.
- Complete `test_pipeline_gold.py` and write `test_no_leakage.py`.

**CHECKPOINT 4**
```bash
cd backend
uv run python -m app.cli build --source gold
uv run pytest -q
uv run python -m app.cli build --source llm
```
Report for the LLM build: matches found for DRU-TRANSFORMER, DRU-COND14 (or mapped IDs), DRU-ACCESS; verdict for "Low risk, expected to be confirmed shortly."; any fallbacks.
Commit: `feat: cross-project matching and board paper check`

### Phase 5: Evaluation, export and API (15 min)

- Implement `evaluate.py`, finish `export.py` (full schema in section 7), `api.py`, CLI `eval` and `all`.
- Final bundle for the demo is the **LLM build** (`build --source llm`). If the LLM build fails any of these, use the gold build for the demo and say so in the README: ASH-DNO first alert not on 2025-05-05; the "Low risk" claim not contradicted after fallback; fewer than 2 of 3 expected cross-project matches.

**CHECKPOINT 5**
```bash
cd backend
uv run python -m app.cli all --source llm
uv run python -m app.cli eval
uv run pytest -q
EW_OFFLINE=1 uv run python -m app.cli build --source llm    # must succeed from cache alone
```
Paste the evaluation table into the checkpoint report. These numbers go into the deck.
Commit: `feat: evaluation, bundle export and API`

### Phase 6: Dashboard (60 min)

- Load the Taste skill (`taste-skill:design-taste-frontend`) and follow its app/dashboard route under the constraints in section 8.2.
- Build in this order, checking each in the browser before moving on: app shell and replay bar → Portfolio → Project (issue list, detail, timeline, tabs) → Source drawer → Board check → Alerts → Evaluation → Sources.
- Use `npm run dev` with the committed `public/data/bundle.json`. The frontend never calls the API.
- If time runs short, cut in this order: Sources view (keep the drawer), Alerts filters (keep the table), play button (keep prev/next), keyboard shortcuts popover. Never cut the replay bar, Project timeline, Board check or Evaluation lead-time card.

**CHECKPOINT 6**
```bash
cd frontend && npm run build && npm run preview
```
Walk the demo story in section 1 at 1280 × 720 and confirm each step. Run the Taste skill's app check and fix its top three issues.
Commit: `feat: dashboard with replay, project timeline, board check and evaluation`

### Phase 7: Hosting, README and handover (20 min)

- `frontend/vite.config.ts`: `base: "./"` so the build works from any path or folder.
- **Vercel** (free, private repo is fine): human runs, from `frontend/`:
  ```bash
  npx vercel login
  npx vercel --prod
  ```
  Accept the detected Vite settings (build `npm run build`, output `dist`). Put the URL in the README.
- Also make the build openable with no hosting: `npx serve dist` from `frontend/` after `npm run build`.
- `README.md` sections, short:
  1. What it is (3 sentences, non-technical).
  2. Run the dashboard (two commands, no Ollama needed).
  3. Rebuild from cached LLM outputs (`EW_OFFLINE=1 ...`), and from scratch with Ollama (models and commands from section 2.2).
  4. How it works (6 bullets: extract, identity, rules, cross-project, board check, replay).
  5. Assumptions (the two assumed dates from the manifest, counterparty mapping, thresholds).
  6. What I would do next (feedback loop on matches, real counterparty registry from procurement data, push alerts into the PM's report template, lessons-learned action tracking, stage-based lessons such as surfacing Netherwood's handover gaps when Ashfield enters commissioning).
  7. Evaluation results (paste the table).
- Human: record a 2-minute screen capture of the demo story (QuickTime, File → New Screen Recording) as a backup in case the room has no internet. Not committed.
- Human: add the reviewers as collaborators on the private repo, or send a zip if they prefer.

**CHECKPOINT 7**
```bash
cd backend && uv run pytest -q
cd ../frontend && npm run build
git status    # clean after commit
```
Commit: `docs: README, hosting config and evaluation results`

---

## 10. Explicitly out of scope (mention on a slide, do not build)

Authentication, document upload UI, a database, emailing or Slack alerts, editing issues in the UI, a real counterparty registry, retraining from match feedback, mobile layout, dark mode, the float vs issue age chart.
