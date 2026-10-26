from datetime import date

from app import rules
from app.models import Issue, Mention, Trigger

D = date.fromisoformat
DOC_TYPES = {"w1": "weekly_report", "w2": "weekly_report", "w3": "weekly_report", "b1": "board_update"}
LABELS = {"dno": "DNO (regional grid company)"}


def issue(*mentions):
    i = Issue(id="X-1", project="p", title="T", description="d", category="other",
              counterparty="dno", first_seen=D(mentions[0][1]))
    for n, (doc, day, status, *rest) in enumerate(mentions):
        i.mentions.append(Mention(
            id=f"m{n}", doc_id=doc, date=D(day), project="p", title="T", description="d", category="other",
            counterparty="dno", status=status, awaiting_third_party=True,
            chase_count=rest[0] if rest else None,
            programme_impact="realised" if status == "materialised" else "none_stated"))
    return i


def persistence(i):
    return [(a.fired_on.isoformat(), a.severity) for a in rules.persistence_alerts(i, DOC_TYPES, LABELS)]


def test_open_open_is_amber_on_second_date():
    assert persistence(issue(("w1", "2025-01-01", "open"), ("w2", "2025-01-08", "open"))) == [("2025-01-08", "amber")]


def test_open_open_open_is_red_on_third():
    i = issue(("w1", "2025-01-01", "open"), ("w2", "2025-01-08", "open"), ("w3", "2025-01-15", "open"))
    assert persistence(i) == [("2025-01-08", "amber"), ("2025-01-15", "red")]


def test_resolved_resets_streak():
    i = issue(("w1", "2025-01-01", "open"), ("w2", "2025-01-08", "resolved"), ("w3", "2025-01-15", "open"))
    assert persistence(i) == []


def test_board_update_ignored():
    i = issue(("w1", "2025-01-01", "open"), ("b1", "2025-01-08", "open"))
    assert persistence(i) == []


def test_persistence_explanation():
    i = issue(("w1", "2025-01-01", "open"), ("w2", "2025-01-08", "open", 3))
    text = rules.persistence_alerts(i, DOC_TYPES, LABELS)[0].explanation
    assert text == ("Raised in 2 documents in a row since 1 Jan 2025 and still open. "
                    "Waiting on DNO (regional grid company). At least 3 chases recorded.")


def trig(d0, deadline):
    return Trigger(id="t", issue_id="X-1", declared_doc_id="w1", declared_on=D(d0),
                   condition_text="c", deadline=D(deadline))


def fires(i, t):
    return [(a.fired_on.isoformat(), a.severity, a.stage_days) for a in rules.trigger_alerts(i, t)]


def test_trigger_staging_in_advance():
    i = issue(("w1", "2025-03-21", "open"))
    assert fires(i, trig("2025-03-21", "2025-06-30")) == [
        ("2025-05-05", "amber", 56), ("2025-06-02", "red", 28), ("2025-06-30", "red", 0)]


def test_trigger_past_stages_collapse_to_most_urgent():
    i = issue(("w1", "2025-06-12", "open"))
    assert fires(i, trig("2025-06-12", "2025-06-26")) == [("2025-06-12", "red", 28), ("2025-06-26", "red", 0)]


def test_trigger_not_fired_once_resolved():
    i = issue(("w1", "2025-03-21", "open"), ("w2", "2025-05-20", "resolved"))
    assert fires(i, trig("2025-03-21", "2025-06-30")) == [("2025-05-05", "amber", 56)]


def test_trigger_not_fired_once_materialised():
    i = issue(("w1", "2025-03-21", "open"), ("w2", "2025-06-10", "materialised"))
    assert fires(i, trig("2025-03-21", "2025-06-30")) == [("2025-05-05", "amber", 56), ("2025-06-02", "red", 28)]


def test_impact_fires_once():
    i = issue(("w1", "2025-01-01", "open"), ("w2", "2025-01-08", "materialised"), ("w3", "2025-01-15", "materialised"))
    a = rules.impact_alert(i, {"w1": "A", "w2": "B", "w3": "C"})
    assert a.fired_on == D("2025-01-08") and a.severity == "red"
    assert a.explanation == "This issue has now affected the programme (B, 8 Jan 2025)."


def test_impact_ignores_historical_incident():
    i = issue(("w1", "2025-01-01", "occurred"))
    i.mentions[0].programme_impact = "realised"
    assert rules.impact_alert(i, {"w1": "A"}) is None
