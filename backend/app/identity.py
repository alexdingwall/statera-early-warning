"""Decide whether a new mention is a known issue (same project) or a new one."""
from . import config, llm
from .models import IdentityJudgement, Issue, Mention
from .rules import issue_status_on

JUDGE_SYSTEM = """Two issue records from the same construction project. Decide whether they describe the same underlying issue: the same problem or dependency, possibly worded differently or at a later stage (for example an unconfirmed date that is later confirmed late is the same issue).
Return JSON {"same": true|false, "reason": "<at most 20 words>"}."""


def issue_text(x: Issue | Mention) -> str:
    return f"{x.title}. {x.description}"


def candidates(mention: Mention, issues: list[Issue]) -> list[tuple[float, Issue]]:
    """Open (not resolved) issues in the mention's project, scored by embedding similarity."""
    pool = [i for i in issues
            if i.project == mention.project and issue_status_on(i, mention.date) != "resolved"]
    pool = [i for i in pool if i.mentions]
    if not pool:
        return []
    vecs = llm.embed([issue_text(mention)] + [issue_text(i) for i in pool])
    scores = vecs[1:] @ vecs[0]
    scored = [(float(s), i) for s, i in zip(scores, pool) if s >= config.IDENTITY_COS_MIN]
    return sorted(scored, key=lambda x: -x[0])[:3]


def judge(mention: Mention, issue: Issue) -> bool:
    user = (f"Earlier issue (first seen {issue.first_seen.isoformat()}): {issue_text(issue)}\n"
            f"New mention ({mention.date.isoformat()}): {issue_text(mention)}")
    res = llm.chat_json(JUDGE_SYSTEM, user, IdentityJudgement, tag="identity")
    return res.same


def assign(mention: Mention, known: list[Issue], taken: set[str]) -> Issue | None:
    """Existing issue for this mention, or None to create a new one.

    `taken` holds ids of issues already given a mention from this document: one mention per issue per document.
    """
    for _score, issue in candidates(mention, known):
        if issue.id in taken:
            continue
        if judge(mention, issue):
            return issue
    return None
