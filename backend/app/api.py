import json
import threading

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel

from . import config, export, intake, llm, pipeline

app = FastAPI(title="Early Warning")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://localhost:4173", "http://127.0.0.1:4173", "http://127.0.0.1:5173"], allow_methods=["*"], allow_headers=["*"])


@app.get("/api/health")
def health():
    return {"ok": True, "model": config.LLM_MODEL}


@app.get("/api/bundle")
def bundle():
    return json.loads(config.BUNDLE_OUT.read_text(encoding="utf-8"))


@app.post("/api/rebuild")
def rebuild(source: str = "llm"):
    res = pipeline.build(source)
    export.write(res)
    return res.evaluation


_lock = threading.Lock()


class NewDocument(BaseModel):
    filename: str
    text: str
    project: str
    doc_type: str
    date: str
    title: str
    author: str | None = None


def _rebuild() -> dict:
    res = pipeline.build("llm")
    return export.write(res)


@app.post("/api/documents")
def add_document(d: NewDocument):
    """Save a report, have the local model read it, rebuild everything, and return the new bundle."""
    if not _lock.acquire(blocking=False):
        raise HTTPException(409, "Another report is being read. Try again in a minute.")
    try:
        try:
            doc_id = intake.add(filename=d.filename, text=d.text, project=d.project, doc_type=d.doc_type,
                                day=d.date, title=d.title, author=d.author)
        except ValueError as e:
            raise HTTPException(400, str(e)) from e
        try:
            bundle = _rebuild()
        except Exception as e:   # model down, invalid output, anything: leave no half-added report behind
            intake.remove(doc_id)
            hint = "Is Ollama running?" if isinstance(e, llm.LLMFailure) or "onnect" in str(e) else ""
            raise HTTPException(500, f"Could not read the report. {hint} ({type(e).__name__}: {str(e)[:200]})") from e
        return {"doc_id": doc_id, "bundle": bundle}
    finally:
        _lock.release()


@app.delete("/api/documents")
def remove_added_documents():
    """Back to the committed sample documents."""
    with _lock:
        intake.remove()
        return {"bundle": _rebuild()}
