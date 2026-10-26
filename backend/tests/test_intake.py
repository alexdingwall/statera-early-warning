import pytest

from app import intake
from app.loaders import load_all


@pytest.fixture(autouse=True)
def sandbox(tmp_path, monkeypatch):
    monkeypatch.setattr(intake, "UPLOAD_DIR", tmp_path / "uploads")
    monkeypatch.setattr(intake, "UPLOAD_INDEX", tmp_path / "uploads.yaml")


def add(**over):
    args = dict(filename="wk28.txt", text="Ashfield weekly\nDNO still open.", project="ashfield", doc_type="weekly_report",
                day="2025-07-11", title="Ashfield week 28", author=None)
    return intake.add(**{**args, **over})


def test_added_report_is_loaded_with_the_sample_and_can_be_removed():
    base = len(load_all().documents)
    doc_id = add()
    docs = load_all().documents
    assert len(docs) == base + 1 and docs[-1].id == doc_id and docs[-1].text.startswith("Ashfield weekly")
    intake.remove()
    assert len(load_all().documents) == base


@pytest.mark.parametrize("over, message", [
    ({"project": "nowhere"}, "Unknown project"),
    ({"doc_type": "poem"}, "Unknown report type"),
    ({"day": "11/07/2025"}, "must look like"),
    ({"day": "2026-01-01"}, "replay window"),
    ({"text": "   "}, "empty"),
    ({"title": " "}, "title"),
])
def test_rejects_bad_input(over, message):
    with pytest.raises(ValueError, match=message):
        add(**over)


def test_file_name_is_made_safe_and_not_reused():
    add(filename="../../etc/pass wd.md")
    assert [p.name for p in intake.UPLOAD_DIR.iterdir()] == ["pass wd.md"]
    with pytest.raises(ValueError, match="already exists"):
        add(filename="pass wd.md")
