"""Write the single JSON bundle the static frontend reads."""
import json
from datetime import date, datetime, timezone

from . import config
from .pipeline import Result


def _d(x):
    return x.isoformat() if isinstance(x, date) else x


def _gt_issue(res, gold_id):
    return next((i.id for i in res.issues.values() if (i.gold_id or i.id) == gold_id), gold_id)


def build_bundle(res: Result) -> dict:
    data = res.data
    docs = []
    for d in sorted(data.documents, key=lambda d: (d.date, d.id)):
        row = {"id": d.id, "project": d.project, "doc_type": d.doc_type, "date": _d(d.date),
               "author": d.author, "title": d.title, "file": d.file, "text": d.text,
               "replay_excluded": d.replay_excluded}
        if d.date_note:
            row["date_note"] = d.date_note
        if d.excluded_reason:
            row["excluded_reason"] = d.excluded_reason
        docs.append(row)

    projects = []
    for p in data.projects:
        row = {"id": p["id"], "name": p["name"], "capacity": p.get("capacity"), "pm": p.get("pm"),
               "baseline_energisation": _d(p["baseline_energisation"]),
               "commercial_date": _d(p.get("commercial_date")), "commercial_label": p["commercial_label"],
               "phases": [{"from": _d(x["from"]), "phase": x["phase"]} for x in p["phases"]]}
        if p.get("actual_energisation"):
            row["actual_energisation"] = _d(p["actual_energisation"])
        projects.append(row)

    issues = []
    for i in sorted(res.issues.values(), key=lambda i: (i.first_seen, i.id)):
        ms = sorted(i.mentions, key=lambda m: (m.date, m.id))
        row = {"id": i.id, "project": i.project, "title": i.title, "description": i.description,
               "category": i.category, "counterparty": i.counterparty, "first_seen": _d(i.first_seen),
               "mentions": [{
                   "id": m.id, "doc_id": m.doc_id, "date": _d(m.date), "status": m.status,
                   "awaiting_third_party": m.awaiting_third_party, "chase_count": m.chase_count,
                   "programme_impact": m.programme_impact, "description": m.description,
                   "evidence_quote": m.evidence_quote,
                   "quote_span": list(m.quote_span) if m.quote_span else None,
                   "quote_valid": m.quote_valid} for m in ms]}
        if i.gold_id:
            row["gold_id"] = i.gold_id
        issues.append(row)

    return {
        "meta": {"generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                 "source": res.source, "model": config.LLM_MODEL, "embed_model": config.EMBED_MODEL,
                 "prompt_version": config.PROMPT_VERSION,
                 "window": {"start": _d(data.replay_window["start"]), "end": _d(data.replay_window["end"])}},
        "projects": projects,
        "counterparties": data.counterparties["entities"],
        "documents": docs,
        "issues": issues,
        "triggers": [{"id": t.id, "issue_id": t.issue_id, "declared_doc_id": t.declared_doc_id,
                      "declared_on": _d(t.declared_on), "condition_text": t.condition_text,
                      "deadline": _d(t.deadline)} for t in res.triggers],
        "alerts": [{**{k: _d(v) for k, v in {
            "id": a.id, "issue_id": a.issue_id, "project": a.project, "rule": a.rule,
            "severity": a.severity, "fired_on": a.fired_on, "title": a.title,
            "explanation": a.explanation}.items()},
            **({"stage_days": a.stage_days} if a.stage_days is not None else {})} for a in res.alerts],
        "matches": [{"id": m.id, "issue_id": m.issue_id, "prior_issue_id": m.prior_issue_id,
                     "score": round(m.score, 3), "confidence": m.confidence, "reasons": m.reasons,
                     "explanation": m.explanation} for m in res.matches],
        "programme_snapshots": [{"project": s.project, "doc_id": s.doc_id, "date": _d(s.date),
                                 "baseline": _d(s.baseline), "forecast": _d(s.forecast),
                                 "float_days": s.float_days} for s in res.snapshots],
        "status_timeline": [{k: _d(v) for k, v in row.items()} for row in res.status_timeline],
        "board_checks": res.board_checks,
        "ground_truth_events": [{**{k: _d(v) for k, v in e.items()}, "issue_id": _gt_issue(res, e["issue_id"])}
                                for e in data.ground_truth_events],
        "lessons": [{"id": l["id"], "source_doc": l["source_doc"], "title": l["title"], "summary": l["summary"],
                     "action": l["action"], "owner": l["owner"], "status": l["status"],
                     "applies_to": l["applies_to"]} for l in data.lessons],
        "evaluation": res.evaluation,
    }


def write(res: Result, path=None) -> dict:
    path = path or config.BUNDLE_OUT
    bundle = build_bundle(res)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(bundle, indent=2, sort_keys=True, ensure_ascii=False) + "\n", encoding="utf-8")
    return bundle
