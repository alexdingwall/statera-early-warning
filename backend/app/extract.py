import re
from dataclasses import dataclass, field
from datetime import date

from rapidfuzz import fuzz

from . import llm
from .loaders import Data, Document
from .models import (LLMExtraction, LLMMention, Mention, MTrigger, ProgrammeSnapshot)

SYSTEM_PROMPT = """You extract project issues from documents about building grid-scale battery storage sites.
Return JSON that matches the schema exactly.

Definitions and rules:
- An issue is a risk, problem, delay, unanswered dependency, constraint or past incident that affects or could affect programme, cost or handover. Work that is simply complete is not an issue. Cost line items in a budget are not issues unless the document calls them a problem or risk; a cost overrun as a whole may be one issue.
- Return one mention per distinct underlying issue in this document. Do not split one issue into several: items from one checklist or list of outstanding items (for example handover items) are one issue. Do not merge unrelated issues.
- title: at most 10 words, neutral wording, no project name. Name the underlying problem (what went wrong, or what is awaited), never the document's lesson, meeting or conclusion about it.
- description: one or two plain sentences.
- category, choose the single best fit:
  grid_connection = connection works, dates or approvals from the network operator;
  planning = planning permission or planning condition discharge, including documents owed for a condition;
  procurement_supplier = equipment orders, lead times and supplier delivery (for example transformers);
  contractor_performance = a contractor's own workmanship or conduct, when no other category fits better;
  site_access = roads, tracks, crane or delivery access to the site;
  ground_conditions = drainage, standing water, soil, ground investigation;
  environmental = ecology, nesting seasons, hedgerows, protected species;
  weather = weather delays;
  commissioning = testing, snagging, software or firmware on installed equipment;
  handover = handover to operations, documentation, training, spares;
  cost = cost overruns and variations;
  other = anything else.
- counterparty_role: who the issue depends on or was caused by. Use one of: DNO, civils contractor, contractor, transformer supplier, LPA, landowner, internal. Use null if none is clear.
- status:
  open = unresolved as of this document and not yet causing a confirmed slip;
  resolved = the document says it is done or closed;
  materialised = in a current progress report, the issue has now caused a programme slip or a confirmed adverse date;
  occurred = a past incident described in a retrospective, summary or lessons document, whatever its impact was.
- awaiting_third_party: true if the team is waiting on a response or deliverable from someone outside the project team.
- chase_count: the number of chases or requests the document states for this issue, otherwise null.
- programme_impact: realised if a slip has happened, potential if the document says it could affect the programme, otherwise none_stated.
- triggers: normally an empty list. Add a trigger only when a sentence in the document states a condition or a time limit after which the issue becomes critical or the programme is at risk (for example "if X does not happen within two weeks", "will become critical if it slips past June", "will change if ... into the autumn"). The document date, a month in which the document was written, or a forecast energisation date is never a trigger. condition_text must be copied from that sentence. Resolve deadline_date to yyyy-mm-dd using the document date {doc_date}: a named month means the last day of that month; "within N weeks" means the document date plus N weeks; "autumn" means 1 September of that year. If it cannot be resolved, use null.
- evidence_quote: copy an exact, contiguous piece of the document text, at most 200 characters, that supports the mention. Do not paraphrase.
- programme: fill only values the document states. Dates as yyyy-mm-dd. Use null otherwise."""


RETROSPECTIVE_DOC_TYPES = {"commissioning_summary", "lessons_learned"}


@dataclass
class ExtractResult:
    doc_id: str
    mentions: list[Mention]
    snapshot: ProgrammeSnapshot | None
    fallback: str | None = None          # reason, if gold was used for this document
    notes: list[str] = field(default_factory=list)


# ---------- helpers ----------

def _norm_with_map(text: str) -> tuple[str, list[int]]:
    """Collapse whitespace; return the normalised text and, per char, its index in the original."""
    out, idx, prev_space = [], [], False
    for i, ch in enumerate(text):
        if ch.isspace():
            if prev_space or not out:
                continue
            out.append(" ")
            idx.append(i)
            prev_space = True
        else:
            out.append(ch)
            idx.append(i)
            prev_space = False
    return "".join(out), idx


def locate_quote(text: str, quote: str) -> tuple[int, int] | None:
    """Span of the quote in the original text: exact (whitespace-normalised) or fuzzy >= 90."""
    ntext, idx = _norm_with_map(text)
    nquote = " ".join(quote.split())
    if not nquote:
        return None
    pos = ntext.find(nquote)
    if pos < 0:
        al = fuzz.partial_ratio_alignment(nquote, ntext)
        if al is None or al.score < 90:
            return None
        start, end = al.dest_start, al.dest_end
    else:
        start, end = pos, pos + len(nquote)
    if end <= start:
        return None
    return idx[start], idx[end - 1] + 1


def parse_iso(s: str | None) -> date | None:
    if not s:
        return None
    try:
        return date.fromisoformat(s.strip())
    except ValueError:
        return None


def map_counterparty(data: Data, project: str, role: str | None) -> str | None:
    if not role or not role.strip():
        return None
    r = role.lower().replace("_", " ").strip()
    cp = data.counterparties
    for rule in cp["rules"]:
        if r in rule["roles"] and rule["project"] in ("*", project):
            return rule["entity"]
    return cp["fallback"].format(project=project, role=r)


_DMY = r"(\d{2})/(\d{2})/(\d{4})"


def _dmy(m: re.Match) -> date:
    return date(int(m.group(3)), int(m.group(2)), int(m.group(1)))


def parse_programme(doc: Document) -> ProgrammeSnapshot | None:
    """Deterministic read of the programme block (used in gold mode)."""
    t = doc.text
    base = re.search(r"Baseline energisation:?\s*" + _DMY, t)
    fc = re.search(r"(?:Current )?forecast:?\s*" + _DMY, t)
    fl = re.search(r"Float(?: remaining)?:?\s*(\d+|zero)", t)
    if not (base or fc or fl):
        return None
    return ProgrammeSnapshot(
        project=doc.project, doc_id=doc.id, date=doc.date,
        baseline=_dmy(base) if base else None,
        forecast=_dmy(fc) if fc else None,
        float_days=(0 if fl.group(1) == "zero" else int(fl.group(1))) if fl else None,
    )


# ---------- gold ----------

def extract_gold(doc: Document, data: Data) -> ExtractResult:
    mentions = []
    for issue in data.gold["issues"]:
        for gm in issue["mentions"]:
            if gm["doc"] != doc.id:
                continue
            mentions.append(Mention(
                id=f"{doc.id}:{issue['id']}", doc_id=doc.id, date=doc.date, project=doc.project,
                title=issue["title"], description=issue["title"], category=issue["category"],
                counterparty=issue["counterparty"], status=gm["status"],
                awaiting_third_party=gm["awaiting_third_party"], chase_count=gm["chase_count"],
                programme_impact=gm["programme_impact"],
                triggers=[MTrigger(t["condition"], t["deadline"]) for t in gm["triggers"]],
                evidence_quote=None, quote_span=None, quote_valid=True, gold_issue_id=issue["id"],
            ))
    return ExtractResult(doc.id, mentions, parse_programme(doc))


# ---------- LLM ----------

def _to_mention(doc: Document, n: int, m: LLMMention, data: Data) -> Mention:
    words = m.title.split()
    title = " ".join(words[:10])

    span, valid = None, True
    quote = m.evidence_quote.strip() or None
    if quote:
        span = locate_quote(doc.text, quote)
        valid = span is not None
        if span:
            quote = doc.text[span[0]:span[1]]
    else:
        valid = False

    triggers = []
    for t in ([] if doc.doc_type in RETROSPECTIVE_DOC_TYPES else m.triggers):   # past incidents set no deadlines
        d = parse_iso(t.deadline_date)
        if d is not None and d < doc.date:
            d = None
        triggers.append(MTrigger(t.condition_text.strip(), d))

    status = m.status
    if status == "materialised" and doc.doc_type in RETROSPECTIVE_DOC_TYPES:
        status = "occurred"   # a retrospective describes the past; it cannot report a live slip

    return Mention(
        id=f"{doc.id}#{n}", doc_id=doc.id, date=doc.date, project=doc.project,
        title=title, description=m.description.strip(), category=m.category,
        counterparty=map_counterparty(data, doc.project, m.counterparty_role),
        status=status, awaiting_third_party=m.awaiting_third_party,
        chase_count=m.chase_count, programme_impact=m.programme_impact,
        triggers=triggers, evidence_quote=quote, quote_span=span, quote_valid=valid,
    )


def extract_llm(doc: Document, data: Data) -> ExtractResult:
    system = SYSTEM_PROMPT.replace("{doc_date}", doc.date.isoformat())
    user = (f"Document date: {doc.date.isoformat()}\nProject: {doc.project}\n"
            f"Document type: {doc.doc_type}\n\n---\n{doc.text}\n---")
    ex: LLMExtraction = llm.chat_json(system, user, LLMExtraction, tag=f"extract-{doc.id}")
    mentions = [_to_mention(doc, i + 1, m, data) for i, m in enumerate(ex.mentions)]

    # The programme block is structured text, so stated values are read by code. The model's own programme
    # output is not used: it filled in values the document does not state.
    snap = parse_programme(doc)
    return ExtractResult(doc.id, mentions, snap)


def extract_document(doc: Document, data: Data, source: str = "llm") -> ExtractResult:
    if source == "gold":
        return extract_gold(doc, data)
    try:
        return extract_llm(doc, data)
    except llm.LLMFailure as e:
        res = extract_gold(doc, data)
        res.fallback = f"{doc.id}: {e}"
        return res
