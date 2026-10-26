from dataclasses import dataclass
from datetime import date
from typing import Any

import yaml

from .config import DATA, DOCS


@dataclass
class Document:
    id: str
    file: str
    project: str
    doc_type: str
    date: date
    author: str | None
    title: str
    replay_excluded: bool
    text: str
    date_note: str | None = None
    excluded_reason: str | None = None


@dataclass
class Data:
    documents: list[Document]
    replay_window: dict[str, date]
    ground_truth_events: list[dict[str, Any]]
    projects: list[dict[str, Any]]
    counterparties: dict[str, Any]
    gold: dict[str, Any]

    def doc(self, doc_id: str) -> Document:
        return next(d for d in self.documents if d.id == doc_id)


def _yaml(path):
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f)


def load_all() -> Data:
    manifest = _yaml(DATA / "manifest.yaml")
    docs = []
    for m in manifest["documents"]:
        path = DOCS / m["file"]
        if not path.exists():
            raise FileNotFoundError(f"Manifest document missing from data/docs: {m['file']}")
        docs.append(Document(
            id=m["id"], file=m["file"], project=m["project"], doc_type=m["doc_type"],
            date=m["date"], author=m.get("author"), title=m["title"],
            replay_excluded=m["replay_excluded"], text=path.read_text(encoding="utf-8"),
            date_note=m.get("date_note"), excluded_reason=m.get("excluded_reason"),
        ))
    ids = [d.id for d in docs]
    if len(set(ids)) != len(ids):
        raise ValueError("Duplicate document ids in manifest")
    gold = _yaml(DATA / "gold" / "gold.yaml")
    for issue in gold["issues"]:
        for men in issue["mentions"]:
            if men["doc"] not in ids:
                raise ValueError(f"Gold mention references unknown doc {men['doc']}")
    return Data(
        documents=docs,
        replay_window=manifest["replay_window"],
        ground_truth_events=manifest["ground_truth_events"],
        projects=_yaml(DATA / "projects.yaml")["projects"],
        counterparties=_yaml(DATA / "counterparties.yaml"),
        gold=gold,
    )
