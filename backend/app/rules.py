"""Deterministic alert rules. No LLM: every alert explanation is a template."""
from datetime import date, timedelta

from . import config
from .models import Alert, Issue, Match, Mention, Trigger


def fmt(d: date) -> str:
    """User-facing date, e.g. 16 May 2025."""
    return f"{d.day} {d:%b %Y}"


def sorted_mentions(issue: Issue) -> list[Mention]:
    return sorted(issue.mentions, key=lambda m: (m.date, m.id))


def issue_status_on(issue: Issue, d: date) -> str | None:
    """Status of the latest mention dated on or before d (None if not yet seen)."""
    latest = None
    for m in sorted_mentions(issue):
        if m.date <= d:
            latest = m
    return latest.status if latest else None


def _mentions_upto(issue: Issue, d: date) -> list[str]:
    return [m.id for m in sorted_mentions(issue) if m.date <= d]


def persistence_alerts(issue: Issue, doc_types: dict[str, str], labels: dict[str, str]) -> list[Alert]:
    alerts = []
    streak: list[Mention] = []
    fired = set()
    for m in sorted_mentions(issue):
        if doc_types[m.doc_id] not in config.PERSISTENCE_DOC_TYPES:
            continue
        if m.status != "open":
            streak = []
            continue
        streak.append(m)
        n = len(streak)
        level = None
        if n == config.PERSISTENCE_AMBER:
            level = "amber"
        elif n == config.PERSISTENCE_RED:
            level = "red"
        if level and level not in fired:
            fired.add(level)
            text = f"Raised in {n} documents in a row since {fmt(streak[0].date)} and still open."
            if any(s.awaiting_third_party for s in streak) and issue.counterparty:
                text += f" Waiting on {labels.get(issue.counterparty, issue.counterparty)}."
            if m.chase_count is not None:
                text += f" {m.chase_count} chases recorded."
            alerts.append(Alert(
                id=f"ALR-{issue.id}-PERSISTENCE-{level}", issue_id=issue.id, project=issue.project,
                rule="PERSISTENCE", severity=level, fired_on=m.date, title=issue.title,
                explanation=text, used_mention_ids=[s.id for s in streak]))
    return alerts


def trigger_alerts(issue: Issue, trig: Trigger) -> list[Alert]:
    if trig.deadline is None:
        return []
    d0, D = trig.declared_on, trig.deadline
    past = [s for s in config.TRIGGER_STAGES_DAYS if D - timedelta(days=s) < d0]
    fires: list[tuple[int, date]] = []
    if past:
        s = min(past)
        fires.append((s, d0))
    for s in config.TRIGGER_STAGES_DAYS:
        fire = D - timedelta(days=s)
        if fire >= d0:
            fires.append((s, fire))

    alerts = []
    for s, fire in fires:
        if issue_status_on(issue, fire) in ("resolved", "materialised"):
            continue
        if s == 0:
            text = f"The deadline set in the report on {fmt(d0)} ({fmt(D)}) has been reached and the issue is still open."
        else:
            days_left = (D - fire).days
            text = (f"On {fmt(d0)} the report said: \"{trig.condition_text}\". "
                    f"That point is {days_left} days away ({fmt(D)}) and the issue is still open.")
        alerts.append(Alert(
            id=f"ALR-{issue.id}-TRIGGER-{s}", issue_id=issue.id, project=issue.project,
            rule="TRIGGER", severity=config.TRIGGER_STAGE_SEVERITY[s], fired_on=fire, title=issue.title,
            explanation=text, stage_days=s, used_mention_ids=_mentions_upto(issue, fire)))
    return alerts


def impact_alert(issue: Issue, doc_titles: dict[str, str]) -> Alert | None:
    for m in sorted_mentions(issue):
        if m.status == "occurred":
            continue
        if m.status == "materialised" or m.programme_impact == "realised":
            return Alert(
                id=f"ALR-{issue.id}-IMPACT-red", issue_id=issue.id, project=issue.project, rule="IMPACT",
                severity="red", fired_on=m.date, title=issue.title,
                explanation=f"This issue has now affected the programme ({doc_titles[m.doc_id]}, {fmt(m.date)}).",
                used_mention_ids=[m.id])
    return None


def prior_incident_alerts(issues: dict[str, Issue], matches: list[Match]) -> list[Alert]:
    alerts = []
    for mt in matches:
        issue, prior = issues[mt.issue_id], issues[mt.prior_issue_id]
        first = sorted_mentions(issue)[0]
        alerts.append(Alert(
            id=f"ALR-{issue.id}-PRIOR_INCIDENT-{prior.id}", issue_id=issue.id, project=issue.project,
            rule="PRIOR_INCIDENT", severity="info", fired_on=issue.first_seen, title=issue.title,
            explanation=f"Similar to {prior.title} at {prior.project.capitalize()} ({fmt(prior.first_seen)}). {mt.explanation}",
            used_mention_ids=[first.id]))
    return alerts


def compute(issues: dict[str, Issue], triggers: list[Trigger], matches: list[Match],
            doc_types: dict[str, str], doc_titles: dict[str, str], labels: dict[str, str],
            window_end: date) -> list[Alert]:
    alerts: list[Alert] = []
    for issue in issues.values():
        alerts += persistence_alerts(issue, doc_types, labels)
        for t in triggers:
            if t.issue_id == issue.id:
                alerts += trigger_alerts(issue, t)
        a = impact_alert(issue, doc_titles)
        if a:
            alerts.append(a)
    alerts += prior_incident_alerts(issues, matches)

    alerts = [a for a in alerts if a.fired_on <= window_end]
    # Two triggers in different documents can stage the identical alert (same issue, rule, stage and day).
    unique: dict[tuple, Alert] = {}
    for a in alerts:
        unique.setdefault((a.issue_id, a.rule, a.severity, a.stage_days, a.fired_on), a)
    alerts = list(unique.values())
    # Two triggers can stage the same alert id (same issue, same stage): keep ids unique.
    seen: dict[str, int] = {}
    for a in sorted(alerts, key=lambda a: (a.fired_on, a.id)):
        seen[a.id] = seen.get(a.id, 0) + 1
        if seen[a.id] > 1:
            a.id = f"{a.id}-{seen[a.id]}"
    return sorted(alerts, key=lambda a: (a.fired_on, a.id))


def active_alerts(alerts: list[Alert], issues: dict[str, Issue], d: date) -> list[Alert]:
    return [a for a in alerts
            if a.fired_on <= d and issue_status_on(issues[a.issue_id], d) not in (None, "resolved")]
