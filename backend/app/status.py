"""Reported vs evidence-based status per project, exported as change points."""
import re
from datetime import date, timedelta

from .loaders import Document
from .models import Alert, Issue, ProgrammeSnapshot
from .rules import active_alerts

REPORT_TYPES = {"weekly_report", "board_update"}


def _quote(doc: Document, snap: ProgrammeSnapshot | None, in_delay: bool) -> str | None:
    flat = " ".join(doc.text.split())
    patterns = ([r"FORECAST SLIPPED \d+ DAYS", r"Status: in delay", r"Float: zero, now in delay"] if in_delay
                else [r"Energisation forecast [^.]*?in line with baseline", r"Current forecast:? \d{2}/\d{2}/\d{4}"])
    for p in patterns:
        m = re.search(p, flat)
        if m:
            return m.group(0)
    return None


def reported_on(docs: list[Document], snaps: list[ProgrammeSnapshot], project: str, d: date):
    """(status, doc_id, quote) from the latest weekly report or board update dated <= d."""
    cands = [x for x in docs if x.project == project and x.doc_type in REPORT_TYPES and x.date <= d]
    if not cands:
        return None, None, None
    doc = max(cands, key=lambda x: (x.date, x.id))
    snap = next((s for s in snaps if s.doc_id == doc.id), None)
    late = bool(snap and snap.forecast and snap.baseline and snap.forecast > snap.baseline)
    in_delay = late or "in delay" in doc.text.lower()
    return ("in_delay" if in_delay else "on_programme"), doc.id, _quote(doc, snap, in_delay)


def compute(issues: dict[str, Issue], alerts: list[Alert], docs: list[Document],
            snaps: list[ProgrammeSnapshot], projects: list[str], window: dict) -> list[dict]:
    out = []
    for p in projects:
        p_issues = {i.id: i for i in issues.values() if i.project == p}
        p_alerts = [a for a in alerts if a.project == p]
        last = None
        d = window["start"]
        while d <= window["end"]:
            act = [a for a in active_alerts(p_alerts, p_issues, d) if a.severity in ("red", "amber")]
            red = [a.id for a in act if a.severity == "red"]
            amber = [a.id for a in act if a.severity == "amber"]
            ev = "at_risk" if red else "watch" if amber else "on_track"
            reasons = red if red else amber
            rep, rdoc, rquote = reported_on(docs, snaps, p, d)
            row = {"project": p, "date": d, "evidence_status": ev, "evidence_reasons": sorted(reasons),
                   "reported_status": rep, "reported_source_doc": rdoc, "reported_quote": rquote,
                   "divergent": rep == "on_programme" and ev == "at_risk"}
            key = {k: v for k, v in row.items() if k != "date"}
            if key != last:
                out.append(row)
                last = key
            d += timedelta(days=1)
    return out
