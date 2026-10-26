"""Watch notes: a counterparty has caused a given kind of incident on another project, and this project uses it too.

Prevention rather than alerting: a note is live from the earlier incident until this project raises the same kind of
issue with the same counterparty (after that, the alerts and "Last time" take over)."""
from collections import defaultdict
from datetime import date

from .models import Issue
from .rules import sorted_mentions

INCIDENT_STATUSES = {"occurred", "materialised"}


def _incident_date(issue: Issue) -> date | None:
    return next((m.date for m in sorted_mentions(issue) if m.status in INCIDENT_STATUSES), None)


def compute(issues: dict[str, Issue]) -> list[dict]:
    used = defaultdict(set)                    # counterparty -> projects that use it
    incidents = defaultdict(list)              # (counterparty, category) -> [(date, issue)]
    own_first = {}                             # (project, counterparty, category) -> first_seen
    for i in issues.values():
        if not i.counterparty or i.counterparty == "internal":
            continue
        used[i.counterparty].add(i.project)
        key = (i.project, i.counterparty, i.category)
        own_first[key] = min(own_first.get(key, i.first_seen), i.first_seen)
        if (d := _incident_date(i)):
            incidents[(i.counterparty, i.category)].append((d, i))

    notes = []
    for (cp, cat), found in sorted(incidents.items()):
        for project in sorted(used[cp]):
            prior = sorted(((d, i) for d, i in found if i.project != project), key=lambda x: (x[0], x[1].id))
            if not prior:
                continue
            start, until = prior[0][0], own_first.get((project, cp, cat))
            if until is not None and until <= start:
                continue                       # this project already had its own issue first
            notes.append({"id": f"WATCH-{project}-{cp}-{cat}", "project": project, "counterparty": cp,
                          "category": cat, "from": start, "until": until,
                          "incidents": [{"issue_id": i.id, "project": i.project, "date": d} for d, i in prior]})
    return notes
