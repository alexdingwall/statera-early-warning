"""Add a report to the running system: save it, register it, and let the pipeline read it.

Added reports live in data/uploads.yaml and data/uploads/ (both git-ignored), so the committed sample stays untouched
and "Remove added reports" returns to it exactly."""
import re
import shutil
from datetime import date

import yaml

from . import config

UPLOAD_DIR = config.DATA / "uploads"
UPLOAD_INDEX = config.DATA / "uploads.yaml"
DOC_TYPES = ["weekly_report", "site_visit", "planning_status", "procurement_issue", "handover_status",
             "commissioning_summary", "board_update"]
MAX_CHARS = 200_000


def _entries() -> list[dict]:
    if not UPLOAD_INDEX.exists():
        return []
    return yaml.safe_load(UPLOAD_INDEX.read_text(encoding="utf-8")) or []


def _write(entries: list[dict]) -> None:
    if entries:
        UPLOAD_INDEX.write_text(yaml.safe_dump(entries, sort_keys=False, allow_unicode=True), encoding="utf-8")
    elif UPLOAD_INDEX.exists():
        UPLOAD_INDEX.unlink()


def load_entries() -> list[dict]:
    """Manifest-style entries for added reports (read by loaders.load_all)."""
    return _entries()


def add(*, filename: str, text: str, project: str, doc_type: str, day: str, title: str, author: str | None) -> str:
    projects = [p["id"] for p in yaml.safe_load((config.DATA / "projects.yaml").read_text(encoding="utf-8"))["projects"]]
    manifest = yaml.safe_load((config.DATA / "manifest.yaml").read_text(encoding="utf-8"))
    if project not in projects:
        raise ValueError(f"Unknown project: {project}")
    if doc_type not in DOC_TYPES:
        raise ValueError(f"Unknown report type: {doc_type}")
    try:
        d = date.fromisoformat(day)
    except ValueError:
        raise ValueError("The date must look like 2025-07-11") from None
    window = manifest["replay_window"]
    if not (window["start"] <= d <= window["end"]):
        raise ValueError(f"The date must fall inside the replay window ({window['start']} to {window['end']})")
    if not text.strip():
        raise ValueError("The report is empty")
    if len(text) > MAX_CHARS:
        raise ValueError("The report is too long (200,000 characters at most)")
    if not title.strip():
        raise ValueError("Give the report a title")

    safe = re.sub(r"[^A-Za-z0-9._ -]", "_", filename.rsplit("/", 1)[-1]).strip(" .") or "report.txt"
    if not safe.lower().endswith((".txt", ".md")):
        safe += ".txt"
    entries = _entries()
    taken = {e["file"] for e in entries} | {m["file"] for m in manifest["documents"]}
    if safe in taken:
        raise ValueError("A report with this file name already exists. Rename the file and try again.")
    doc_id = f"up-{len(entries) + 1}-{re.sub(r'[^a-z0-9]+', '-', safe.lower()).strip('-')[:30]}"

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    (UPLOAD_DIR / safe).write_text(text, encoding="utf-8")
    entries.append({"id": doc_id, "file": safe, "project": project, "doc_type": doc_type, "date": d, "author": author or None,
                    "title": title.strip(), "replay_excluded": False, "uploaded": True})
    _write(entries)
    return doc_id


def remove(doc_id: str | None = None) -> None:
    """Remove one added report, or all of them."""
    entries = _entries()
    keep = [e for e in entries if doc_id is not None and e["id"] != doc_id]
    for e in entries:
        if e not in keep:
            (UPLOAD_DIR / e["file"]).unlink(missing_ok=True)
    _write(keep)
    if not keep and UPLOAD_DIR.exists() and not any(UPLOAD_DIR.iterdir()):
        shutil.rmtree(UPLOAD_DIR)
