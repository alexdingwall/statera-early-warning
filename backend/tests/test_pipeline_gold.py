import pytest

from app import export, pipeline


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


def test_ashfield_status(bundle):
    assert status_on(bundle, "ashfield", "2025-03-21")["evidence_status"] == "on_track"
    r = status_on(bundle, "ashfield", "2025-06-30")
    assert (r["evidence_status"], r["reported_status"], r["divergent"]) == ("at_risk", "on_programme", True)
    assert status_on(bundle, "ashfield", "2025-07-04")["reported_status"] == "in_delay"


def test_netherwood_has_no_reported_status(bundle):
    assert status_on(bundle, "netherwood", "2025-03-01")["reported_status"] is None
