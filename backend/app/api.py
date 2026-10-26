import json

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import config, export, pipeline

app = FastAPI(title="Early Warning")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"], allow_methods=["*"], allow_headers=["*"])


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
