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
