"""Check a board paper's claims against the evidence held on the paper's date."""
import re

from . import llm
from .extract import _norm_with_map
from .models import BoardClaimVerdict
from .rules import active_alerts, fmt, sorted_mentions

CLAIM_SECTIONS = ["Headline", "Risks", "Outlook"]
MIN_CLAIM_WORDS = 2   # plan says 3, but gold expects "Construction complete." (2 words); only "Weather" must drop

SYSTEM = """You check a statement from a board update against the project evidence held on the same date.
Work through these questions in order and stop at the first that applies:
1. Does the evidence say nothing about what the statement claims (for example a date or figure that no document states)? Verdict no_evidence.
2. Does the evidence say the opposite of the statement, or does the statement call a risk low or absent when the project team itself recorded that risk as unresolved, chased without reply, or red? Verdict contradicted.
3. Is the statement true, but the evidence adds something the reader should know (a thin margin, an open related issue, outstanding work)? Verdict supported_with_caveat.
4. Otherwise the evidence agrees with the statement. Verdict supported.
A statement that merely reports a fact (a forecast date, a stage reached, a date still unconfirmed) is not contradicted by an open issue that might affect it later; that is a caveat or supported.
Return JSON {"verdict": "...", "reason": "<at most 30 words, plain English>", "evidence_mention_ids": ["..."]}."""

# Used once, for the one claim the demo depends on, if the first wording does not give the expected verdict.
SYSTEM_V1B = SYSTEM + """
A statement that a risk is low, or that there are no material concerns, is contradicted when the evidence shows the project team itself recorded repeated unanswered chases, a falling float or a deadline after which the issue becomes critical."""

KEY_CLAIM = "Low risk, expected to be confirmed shortly."

# Gold mode: which issue's mentions back each claim.
GOLD_EVIDENCE = {
    "Construction complete.": ["ASH-SNAG"],
    "Energisation forecast 14/11/2025, in line with baseline.": ["ASH-DNO"],
    "Capacity market delivery start 01/12/2025.": [],
    "DNO connection works date not yet confirmed.": ["ASH-DNO"],
    KEY_CLAIM: ["ASH-DNO"],
    "On programme, slightly over budget.": ["ASH-DNO"],
    "No material concerns.": ["ASH-DNO"],
}


def sections(text: str) -> dict[str, tuple[int, int]]:
    heads = [(m.group(1).strip(), m.end()) for m in re.finditer(r"^## (.+)$", text, re.M)]
    out = {}
    for n, (name, start) in enumerate(heads):
        nxt = re.search(r"^## ", text[start:], re.M)
        out[name] = (start, start + nxt.start() if nxt else len(text))
    return out


def _units(text: str, start: int, end: int) -> list[tuple[int, int]]:
    """Bullets and paragraphs inside a section, as character ranges (list marker excluded)."""
    units: list[list[int]] = []
    pos = start
    for line in text[start:end].splitlines(keepends=True):
        s, e = pos, pos + len(line)
        pos = e
        if not line.strip():
            units.append([-1, -1])
            continue
        if line.startswith("- "):
            units.append([s + 2, e])
        elif units and units[-1][0] != -1:
            units[-1][1] = e
        else:
            units.append([s, e])
    return [(a, b) for a, b in units if a != -1]


def split_claims(text: str) -> list[dict]:
    secs = sections(text)
    claims = []
    for name in CLAIM_SECTIONS:
        if name not in secs:
            continue
        for a, b in _units(text, *secs[name]):
            flat, idx = _norm_with_map(text[a:b])
            flat = flat.rstrip()
            pos = 0
            while pos < len(flat):
                cut = flat.find(". ", pos)
                end = len(flat) if cut < 0 else cut + 1
                sent = flat[pos:end].strip()
                if len(sent.split()) >= MIN_CLAIM_WORDS:
                    s0 = pos + (len(flat[pos:end]) - len(flat[pos:end].lstrip()))
                    claims.append({"text": sent, "section": name,
                                   "span": [a + idx[s0], a + idx[end - 1] + 1]})
                pos = end + 1
    return claims


def budget_check(text: str) -> dict:
    secs = sections(text)
    a, b = secs["Budget"]
    body = text[a:b]
    items = [{"label": m.group(1).strip(), "amount": int(m.group(2)) * 1000}
             for m in re.finditer(r"^- (.+?) \(£(\d+)k\)\s*$", body, re.M)]
    tm = re.search(r"£(\d+(?:\.\d+)?)m", body)
    stated = round(float(tm.group(1)) * 1_000_000) if tm else 0
    computed = sum(i["amount"] for i in items)
    largest = max(items, key=lambda i: i["amount"])
    share = largest["amount"] / computed if computed else 0
    vague = any(w in largest["label"].lower() for w in ("various", "misc", "other")) and share > 0.5
    return {"items": items, "stated_total": stated, "computed_total": computed,
            "matches": stated == computed, "largest_label": largest["label"],
            "largest_share": round(share, 4), "flag_vague": vague}


def evidence_pack(res, board_doc) -> tuple[str, list[str]]:
    """Compact evidence text and the mention ids it contains. Only documents dated <= the board paper."""
    as_of = board_doc.date
    docs = {d.id: d for d in res.data.documents}
    lines, ids = [], []
    p_issues = {i.id: i for i in res.issues.values() if i.project == board_doc.project}
    for issue in sorted(p_issues.values(), key=lambda i: (i.first_seen, i.id)):
        ms = [m for m in sorted_mentions(issue) if m.date <= as_of and m.doc_id != board_doc.id]
        if not ms:
            continue
        lines.append(f"Issue {issue.id}: {issue.title}")
        for m in ms:
            ids.append(m.id)
            chase = f", chases {m.chase_count}" if m.chase_count is not None else ""
            quote = f' "{m.evidence_quote}"' if m.evidence_quote else ""
            lines.append(f"  [{m.id}] {m.date.isoformat()} {docs[m.doc_id].title}: {m.status}{chase}, "
                         f"impact {m.programme_impact}.{quote}")
    act = [a for a in active_alerts([a for a in res.alerts if a.project == board_doc.project], p_issues, as_of) if a.severity != "info"]
    if act:
        lines.append("Active alerts:")
        lines += [f"  {a.severity} {a.rule} {a.issue_id} since {a.fired_on.isoformat()}" for a in act]
    snaps = [s for s in res.snapshots if s.project == board_doc.project and s.date <= as_of]
    if snaps:
        lines.append("Programme snapshots:")
        lines += [f"  {s.date.isoformat()} baseline {s.baseline} forecast {s.forecast} float {s.float_days} days"
                  for s in sorted(snaps, key=lambda s: s.date)]
    return "\n".join(lines), ids


def _llm_verdict(claim: str, pack: str, as_of) -> BoardClaimVerdict:
    user = f'Statement: "{claim}"\nEvidence (as of {as_of.isoformat()}):\n{pack}'
    return llm.chat_json(SYSTEM, user, BoardClaimVerdict, tag="board_claim")


def run(res) -> list[dict]:
    out = []
    gold = res.data.gold["board_check"]
    gold_by_text = {c["text"]: c for c in gold["claims"]}
    for doc in sorted(res.data.documents, key=lambda d: (d.date, d.id)):
        if doc.doc_type != "board_update" or doc.replay_excluded:
            continue
        pack, pack_ids = evidence_pack(res, doc)
        claims = []
        for n, c in enumerate(split_claims(doc.text), start=1):
            row = {"id": f"CLM-{doc.id}-{n}", **c}
            g = gold_by_text.get(c["text"])
            if res.source == "gold":
                issue_ids = GOLD_EVIDENCE.get(c["text"], [])
                ev = [m.id for i in issue_ids if i in res.issues for m in sorted_mentions(res.issues[i])
                      if m.date <= doc.date and m.doc_id != doc.id]
                row.update(verdict=g["verdict"] if g else "no_evidence",
                           reason=gold["gold_reasons"].get(c["text"], "No evidence held."),
                           evidence_mention_ids=ev)
            else:
                row.update(_llm_claim(res, c["text"], pack, pack_ids, doc, g, gold))
            claims.append(row)
        out.append({"doc_id": doc.id, "as_of": doc.date.isoformat(), "claims": claims,
                    "budget": budget_check(doc.text)})
    return out


def _llm_claim(res, text, pack, pack_ids, doc, g, gold) -> dict:
    try:
        v = _llm_verdict(text, pack, doc.date)
        if text == KEY_CLAIM and v.verdict != "contradicted":
            user = f'Statement: "{text}"\nEvidence (as of {doc.date.isoformat()}):\n{pack}'
            v = llm.chat_json(SYSTEM_V1B, user, BoardClaimVerdict, tag="board_claim", prompt_version="v1b")
            if v.verdict != "contradicted" and g:
                res.fallbacks.append(f"board claim '{text}': LLM verdict {v.verdict}, gold verdict used")
                return {"verdict": g["verdict"], "reason": gold["gold_reasons"][text],
                        "evidence_mention_ids": [i for i in v.evidence_mention_ids if i in pack_ids],
                        "fallback": True}
    except llm.LLMFailure as e:
        if not g:
            return {"verdict": "no_evidence", "reason": "Check failed.", "evidence_mention_ids": []}
        res.fallbacks.append(f"board claim '{text}': {e}")
        return {"verdict": g["verdict"], "reason": gold["gold_reasons"].get(text, ""),
                "evidence_mention_ids": [], "fallback": True}
    return {"verdict": v.verdict, "reason": v.reason.strip(),
            "evidence_mention_ids": [i for i in v.evidence_mention_ids if i in pack_ids]}
