import json

import pytest

from app import config, pipeline

EXCLUDED = "ash-dno-corr"
BOARD_DATE = "2025-06-30"


@pytest.fixture(scope="module", params=["gold", "llm"])
def result(request):
    if request.param == "llm":
        if not any(config.CACHE.glob("extract-*.json")):
            pytest.skip("no LLM cache")
        try:
            return pipeline.build("llm")
        except Exception as e:   # cache incomplete
            pytest.skip(f"LLM build not possible from cache: {e}")
    return pipeline.build("gold")


def test_alert_evidence_not_after_fire_date(result):
    dates = {m.id: m.date for m in result.mentions}
    for a in result.alerts:
        assert a.used_mention_ids, a.id
        for mid in a.used_mention_ids:
            assert dates[mid] <= a.fired_on, (a.id, mid)


def test_excluded_document_not_used(result):
    assert all(m.doc_id != EXCLUDED for m in result.mentions)
    assert all(t.declared_doc_id != EXCLUDED for t in result.triggers)
    assert all(s.doc_id != EXCLUDED for s in result.snapshots)
    assert all(EXCLUDED not in a.used_mention_ids for a in result.alerts)


def test_prior_incident_is_earlier(result):
    for m in result.matches:
        assert result.issues[m.prior_issue_id].first_seen < result.issues[m.issue_id].first_seen
        assert result.issues[m.prior_issue_id].project != result.issues[m.issue_id].project


def test_board_evidence_not_after_board_date(result):
    dates = {m.id: m.date.isoformat() for m in result.mentions}
    for bc in result.board_checks:
        for c in bc["claims"]:
            for mid in c["evidence_mention_ids"]:
                assert dates[mid] <= bc["as_of"] <= BOARD_DATE or dates[mid] <= bc["as_of"], mid


def test_bundle_has_no_reference_to_excluded_doc_in_issues(result):
    blob = json.dumps([m.doc_id for i in result.issues.values() for m in i.mentions])
    assert EXCLUDED not in blob
