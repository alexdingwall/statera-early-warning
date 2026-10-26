"""Match an issue to earlier incidents on other projects."""
import numpy as np

from . import config, llm
from .identity import issue_text
from .models import Issue, Match, XPExplanation
from .rules import sorted_mentions

EXPLAIN_SYSTEM = """An earlier incident on another project may be relevant to a new issue.
Write one plain sentence (at most 30 words) saying why it is relevant and what happened last time, using only the facts given. No speculation.
Return JSON {"explanation": "..."}."""

SOFT_PLANNING = {"planning", "contractor_performance"}


def category_score(a: str, b: str) -> float:
    if a == b:
        return 1.0
    return 0.5 if a in SOFT_PLANNING and b in SOFT_PLANNING else 0.0


def _explain(issue: Issue, prior: Issue, source: str) -> str:
    if source == "gold":
        return f"{prior.title} at {prior.project.capitalize()}."
    outcome = sorted_mentions(prior)[-1].description
    user = (f"New issue ({issue.project.capitalize()}, {issue.first_seen.isoformat()}): {issue_text(issue)}\n"
            f"Earlier incident ({prior.project.capitalize()}, {prior.first_seen.isoformat()}): "
            f"{issue_text(prior)} Outcome recorded: {outcome}")
    return llm.chat_json(EXPLAIN_SYSTEM, user, XPExplanation, tag="xp_explain").explanation.strip()


def compute(issues: dict[str, Issue], source: str, labels: dict[str, str] | None = None) -> list[Match]:
    labels = labels or {}
    items = sorted(issues.values(), key=lambda i: (i.first_seen, i.id))
    if not items:
        return []
    vecs = dict(zip([i.id for i in items], llm.embed([issue_text(i) for i in items])))

    matches: list[Match] = []
    for issue in items:
        scored = []
        for prior in items:
            # leakage guard: another project, and strictly earlier
            if prior.project == issue.project or not prior.first_seen < issue.first_seen:
                continue
            cos = float(np.dot(vecs[issue.id], vecs[prior.id]))
            cat = category_score(issue.category, prior.category)
            same_cp = bool(issue.counterparty and issue.counterparty == prior.counterparty
                           and issue.counterparty != "internal")
            score = 0.5 * cos + 0.3 * cat + 0.2 * (1.0 if same_cp else 0.0)
            if score < config.XP_SHOW_MIN:
                continue
            reasons = []
            if same_cp:
                reasons.append(f"Same counterparty: {labels.get(issue.counterparty, issue.counterparty)}")
            if cat == 1.0:
                reasons.append(f"Same category: {issue.category.replace('_', ' ')}")
            elif cat > 0:
                reasons.append("Related category: planning and contractor performance")
            if cos >= 0.5:
                reasons.append("Similar wording")
            scored.append((score, prior, reasons))
        for score, prior, reasons in sorted(scored, key=lambda x: -x[0])[:2]:
            matches.append(Match(
                id=f"XP-{issue.id}-{prior.id}", issue_id=issue.id, prior_issue_id=prior.id, score=score,
                confidence="high" if score >= config.XP_HIGH else "medium", reasons=reasons,
                explanation=_explain(issue, prior, source)))
    return matches

