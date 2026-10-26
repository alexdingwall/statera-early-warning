import pytest

from app import export, pipeline
from app.loaders import load_all  # noqa: F401


@pytest.fixture(scope="module")
def bundle():
    return export.build_bundle(pipeline.build("gold"))


def alerts_for(bundle, issue_id):
    return [(a["fired_on"], a["rule"], a["severity"], a.get("stage_days"))
            for a in bundle["alerts"] if a["issue_id"] == issue_id]


def status_on(bundle, project, day):
    rows = [r for r in bundle["status_timeline"] if r["project"] == project and r["date"] <= day]
    return rows[-1]


def test_ash_dno_alerts_exact(bundle):
    got = [x for x in alerts_for(bundle, "ASH-DNO") if x[1] != "PRIOR_INCIDENT"]
    assert sorted(got) == [
        ("2025-05-05", "TRIGGER", "amber", 56),
        ("2025-05-16", "PERSISTENCE", "amber", None),
        ("2025-06-02", "TRIGGER", "red", 28),
        ("2025-06-30", "TRIGGER", "red", 0),
        ("2025-07-04", "IMPACT", "red", None),
    ]


def test_dru_cond14_alerts(bundle):
    got = alerts_for(bundle, "DRU-COND14")
    for want in [("2025-05-30", "PRIOR_INCIDENT", "info", None),
                 ("2025-06-12", "PERSISTENCE", "amber", None),
                 ("2025-06-12", "TRIGGER", "red", 28),
                 ("2025-06-13", "PERSISTENCE", "red", None),
                 ("2025-06-26", "TRIGGER", "red", 0),
                 ("2025-07-07", "TRIGGER", "amber", 56)]:
        assert want in got
    assert not any(a[0] < "2025-06-12" and a[1] == "TRIGGER" for a in got)   # no 56-day alert from the first trigger


def test_dru_transformer_alerts(bundle):
    got = alerts_for(bundle, "DRU-TRANSFORMER")
    assert ("2025-02-07", "IMPACT", "red", None) in got
    assert ("2025-02-07", "PRIOR_INCIDENT", "info", None) in got


def test_ashfield_status(bundle):
    assert status_on(bundle, "ashfield", "2025-03-21")["evidence_status"] == "on_track"
    r = status_on(bundle, "ashfield", "2025-06-30")
    assert (r["evidence_status"], r["reported_status"], r["divergent"]) == ("at_risk", "on_programme", True)
    assert status_on(bundle, "ashfield", "2025-07-04")["reported_status"] == "in_delay"


def test_netherwood_has_no_reported_status(bundle):
    assert status_on(bundle, "netherwood", "2025-03-01")["reported_status"] is None


def test_expected_cross_project_matches(bundle):
    gold = load_all().gold
    by_issue = {}
    for m in bundle["matches"]:
        by_issue.setdefault(m["issue_id"], []).append(m)
    rank = {"medium": 1, "high": 2}
    for e in gold["expected_cross_project_matches"]:
        found = [m for m in by_issue.get(e["issue"], []) if m["prior_issue_id"] == e["prior"]]
        assert found, e
        assert rank[found[0]["confidence"]] >= rank[e["min_confidence"]], e
    for iid in gold["expected_no_cross_project_match"]:
        assert iid not in by_issue


def test_board_check(bundle):
    bc = bundle["board_checks"][0]
    verdicts = {c["text"]: c["verdict"] for c in bc["claims"]}
    assert verdicts["Low risk, expected to be confirmed shortly."] == "contradicted"
    assert len(verdicts) == 7
    assert bc["budget"]["flag_vague"] is True
    assert 0.77 <= bc["budget"]["largest_share"] <= 0.78
    assert bc["budget"]["matches"] is True


def test_lead_times(bundle):
    rows = {r["label"]: r["days_earlier"] for r in bundle["evaluation"]["lead_time"]["rows"]}
    assert rows == {"First warning": 59, "First red alert": 31, "Persistence rule alone": 48}


def test_watch_notes_come_before_the_projects_own_issue(bundle):
    got = {(n["project"], n["counterparty"]): (n["from"], n["until"]) for n in bundle["watch"]}
    assert got == {("drumgarve", "transformer_supplier_nd"): ("2024-12-31", "2025-02-07"),
                   ("drumgarve", "civils_contractor_nd"): ("2024-12-31", "2025-05-30")}
    for n in bundle["watch"]:
        assert all(x["project"] != n["project"] and x["date"] >= n["from"] for x in n["incidents"])
        assert n["until"] is None or n["until"] > n["from"]
