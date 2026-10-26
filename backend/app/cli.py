import typer

from . import llm
from .extract import extract_document
from . import export, pipeline
from .loaders import load_all

app = typer.Typer(add_completion=False, no_args_is_help=True)


@app.callback()
def _main():
    """Early Warning command line."""


@app.command()
def extract(source: str = "llm", refresh: bool = False):
    """Extract mentions from every replay document (fills the LLM cache)."""
    data = load_all()
    llm.REFRESH = refresh
    gold_counts: dict[str, int] = {}
    for issue in data.gold["issues"]:
        for m in issue["mentions"]:
            gold_counts[m["doc"]] = gold_counts.get(m["doc"], 0) + 1
    docs = sorted((d for d in data.documents if not d.replay_excluded), key=lambda d: (d.date, d.id))
    for doc in docs:
        res = extract_document(doc, data, source)
        bad = [m.id for m in res.mentions if not m.quote_valid] if source == "llm" else []
        print(f"{doc.id:16} {len(res.mentions):2} mentions (gold {gold_counts.get(doc.id, 0)})"
              f"{'  FALLBACK: ' + res.fallback if res.fallback else ''}"
              f"{'  quote_valid=false: ' + ', '.join(bad) if bad else ''}")
        for m in res.mentions:
            print(f"    - [{m.status}] {m.title}")
    llm.REFRESH = False


@app.command()
def build(source: str = "llm"):
    """Full pipeline -> frontend/public/data/bundle.json."""
    res = pipeline.build(source)
    export.write(res)
    print(f"built {source}: {len(res.issues)} issues, {len(res.alerts)} alerts, "
          f"{len(res.matches)} matches, {len(res.fallbacks)} fallbacks")


if __name__ == "__main__":
    app()
