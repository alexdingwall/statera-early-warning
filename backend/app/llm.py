"""All Ollama calls go through here. Responses are cached on disk in cache/llm."""
import hashlib
import json
import os
import re

import numpy as np
import ollama
from pydantic import BaseModel, ValidationError

from . import config

OFFLINE = os.getenv("EW_OFFLINE") == "1"
REFRESH = False   # set by the CLI for extraction (--refresh)


class LLMFailure(Exception):
    pass


def _key(*parts: str) -> str:
    return hashlib.sha256("".join(parts).encode("utf-8")).hexdigest()


def _path(tag: str, key: str):
    return config.CACHE / f"{tag}-{key[:16]}.json"


def _read(path):
    if path.exists() and not REFRESH:
        return json.loads(path.read_text(encoding="utf-8"))
    return None


def _write(path, request: dict, response) -> None:
    config.CACHE.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"request": request, "response": response}, indent=2, ensure_ascii=False,
                               sort_keys=True), encoding="utf-8")


def _strip_think(text: str) -> str:
    return re.sub(r"<think>.*?</think>", "", text, flags=re.S).strip()


def _chat(messages: list[dict], schema: dict) -> str:
    kwargs = dict(model=config.LLM_MODEL, messages=messages, format=schema, options=config.LLM_OPTIONS)
    try:
        resp = ollama.chat(think=False, **kwargs)
    except TypeError:
        resp = ollama.chat(**kwargs)
    return _strip_think(resp.message.content or "")


def chat_json(system: str, user: str, schema: type[BaseModel], tag: str,
              prompt_version: str | None = None) -> BaseModel:
    version = prompt_version or config.PROMPT_VERSION
    key = _key(config.LLM_MODEL, version, tag, system, user)
    path = _path(tag, key)
    cached = _read(path)
    if cached is not None:
        return schema.model_validate(cached["response"])
    if OFFLINE:
        raise LLMFailure(f"EW_OFFLINE=1 and no cache entry for {tag} ({path.name})")

    request = {"model": config.LLM_MODEL, "prompt_version": version, "tag": tag,
               "system": system, "user": user}
    suffix = ""
    last_error = ""
    for _ in range(3):
        messages = [{"role": "system", "content": system}, {"role": "user", "content": user + suffix}]
        content = _chat(messages, schema.model_json_schema())
        try:
            parsed = schema.model_validate_json(content)
            _write(path, request, parsed.model_dump(mode="json"))
            return parsed
        except ValidationError as e:
            last_error = str(e)
            suffix = f"\n\nYour previous reply was invalid: {last_error}\nReturn valid JSON that matches the schema."
    raise LLMFailure(f"{tag}: invalid JSON after 3 attempts: {last_error[:300]}")


def embed(texts: list[str]) -> np.ndarray:
    """L2-normalised embeddings, cached per text."""
    out = []
    for t in texts:
        inp = "clustering: " + t
        key = _key(config.EMBED_MODEL, "embed", inp)
        path = _path("embed", key)
        cached = _read(path)
        if cached is not None:
            vec = cached["response"]
        else:
            if OFFLINE:
                raise LLMFailure(f"EW_OFFLINE=1 and no cache entry for embed ({path.name})")
            vec = ollama.embed(model=config.EMBED_MODEL, input=[inp]).embeddings[0]
            _write(path, {"model": config.EMBED_MODEL, "input": inp}, vec)
        out.append(vec)
    arr = np.array(out, dtype=np.float64)
    norms = np.linalg.norm(arr, axis=1, keepdims=True)
    return arr / np.where(norms == 0, 1, norms)
