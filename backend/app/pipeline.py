"""Chronological processing. Each document only sees what earlier documents established."""
from dataclasses import dataclass, field

from . import evaluate, identity, rules, status
from .extract import extract_document
from .loaders import Data, load_all
from .models import Alert, Issue, Match, Mention, ProgrammeSnapshot, Trigger


@dataclass
class Result:
    source: str
    data: Data
    issues: dict[str, Issue] = field(default_factory=dict)
    triggers: list[Trigger] = field(default_factory=list)
    alerts: list[Alert] = field(default_factory=list)
    matches: list[Match] = field(default_factory=list)
    watch: list[dict] = field(default_factory=list)
    snapshots: list[ProgrammeSnapshot] = field(default_factory=list)
    status_timeline: list[dict] = field(default_factory=list)
    board_checks: list[dict] = field(default_factory=list)
    fallbacks: list[str] = field(default_factory=list)
    mentions: list[Mention] = field(default_factory=list)
    evaluation: dict = field(default_factory=dict)


def replay_docs(data: Data):
    return sorted((d for d in data.documents if not d.replay_excluded), key=lambda d: (d.date, d.id))


def _new_issue(res: Result, m: Mention) -> Issue:
    if m.gold_issue_id:
        iid = m.gold_issue_id
    else:
        prefix = m.project[:3].upper()
        n = sum(1 for i in res.issues.values() if i.project == m.project) + 1
        iid = f"{prefix}-{n:03d}"
    issue = Issue(id=iid, project=m.project, title=m.title, description=m.description,
                  category=m.category, counterparty=m.counterparty, first_seen=m.date)
    res.issues[iid] = issue
    return issue


def build(source: str = "llm", data: Data | None = None) -> Result:
    data = data or load_all()
    res = Result(source=source, data=data)

    for doc in replay_docs(data):
        ex = extract_document(doc, data, source)
        if ex.fallback:
            res.fallbacks.append(ex.fallback)
        if ex.snapshot:
            res.snapshots.append(ex.snapshot)

        known = list(res.issues.values())          # as known BEFORE this document
        taken: set[str] = set()
        for m in ex.mentions:
            if m.gold_issue_id:
                issue = res.issues.get(m.gold_issue_id) or _new_issue(res, m)
            else:
                issue = identity.assign(m, known, taken) or _new_issue(res, m)
            taken.add(issue.id)
            issue.mentions.append(m)
            res.mentions.append(m)
            for n, t in enumerate(m.triggers, start=1):
                res.triggers.append(Trigger(
                    id=f"TRG-{issue.id}-{doc.id}-{n}", issue_id=issue.id, declared_doc_id=doc.id,
                    declared_on=doc.date, condition_text=t.condition_text, deadline=t.deadline))

    _derive(res)
    return res


def _derive(res: Result) -> None:
    """Everything computed from the issues: matches, alerts, status, board checks."""
    from . import boardcheck, crossproject, watch
    data = res.data
    docs = {d.id: d for d in data.documents}
    labels = {k: v["label"] for k, v in data.counterparties["entities"].items()}
    window = data.replay_window

    res.matches = crossproject.compute(res.issues, res.source, labels)
    res.watch = watch.compute(res.issues)
    res.alerts = rules.compute(
        res.issues, res.triggers, res.matches,
        {k: d.doc_type for k, d in docs.items()}, {k: d.title for k, d in docs.items()},
        labels, window["end"])
    res.status_timeline = status.compute(
        res.issues, res.alerts, replay_docs(data), res.snapshots,
        [p["id"] for p in data.projects], window)
    res.board_checks = boardcheck.run(res)
    evaluate.run(res)
