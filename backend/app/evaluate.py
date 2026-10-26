"""Compare a pipeline run with the human labels in gold.yaml and compute the lead-time table."""
from collections import Counter
from datetime import date
from itertools import combinations

from . import llm
from .rules import fmt

PAIR_MIN = 0.60


def _pair_mentions(res) -> dict[str, tuple[str, dict, dict]]:
    """Extracted mention id -> (gold issue id, gold issue, gold mention), greedy by title similarity per document."""
    gold_by_doc: dict[str, list[tuple[dict, dict]]] = {}
    for gi in res.data.gold["issues"]:
        for gm in gi["mentions"]:
            gold_by_doc.setdefault(gm["doc"], []).append((gi, gm))
    pairs = {}
    for doc_id, golds in gold_by_doc.items():
        ext = [m for m in res.mentions if m.doc_id == doc_id]
        if not ext:
            continue
        vecs = llm.embed([g[0]["title"] for g in golds] + [m.title for m in ext])
        sims = vecs[:len(golds)] @ vecs[len(golds):].T
        cand = sorted(((float(sims[i, j]), i, j) for i in range(len(golds)) for j in range(len(ext))),
                      reverse=True)
        used_g, used_e = set(), set()
        for s, i, j in cand:
            if s < PAIR_MIN:
                break
            if i in used_g or j in used_e:
                continue
            used_g.add(i)
            used_e.add(j)
            pairs[ext[j].id] = (golds[i][0]["id"], golds[i][0], golds[i][1])
    return pairs


def lead_time(res, gold_issue_id: str = "ASH-DNO") -> dict:
    gt = next(e for e in res.data.ground_truth_events if e["issue_id"] == gold_issue_id)
    issue = next((i for i in res.issues.values() if (i.gold_id or i.id) == gold_issue_id), None)
    alerts = sorted((a for a in res.alerts if issue and a.issue_id == issue.id and a.severity != "info"),
                    key=lambda a: a.fired_on)

    def row(label, a):
        d = a.fired_on if a else None
        return {"label": label, "date": d.isoformat() if d else None,
                "days_earlier": (gt["date"] - d).days if d else None}

    return {"issue_id": issue.id if issue else gold_issue_id,
            "ground_truth_date": gt["date"].isoformat(),
            "rows": [row("First warning", alerts[0] if alerts else None),
                     row("First red alert", next((a for a in alerts if a.severity == "red"), None)),
                     row("Persistence rule alone", next((a for a in alerts if a.rule == "PERSISTENCE"), None))]}


def run(res) -> None:
    """Fill res.evaluation and set issue.gold_id (LLM mode)."""
    res.evaluation = {"source": res.source, "fallbacks": list(res.fallbacks)}
    if res.source == "gold":
        res.evaluation["lead_time"] = lead_time(res)
        return

    gold = res.data.gold
    pairs = _pair_mentions(res)

    # map LLM issues to gold issues by majority vote of their mentions
    for issue in res.issues.values():
        votes = Counter(pairs[m.id][0] for m in issue.mentions if m.id in pairs)
        issue.gold_id = votes.most_common(1)[0][0] if votes else None

    gold_total = sum(len(g["mentions"]) for g in gold["issues"])
    n_pairs = len(pairs)
    mentions = res.mentions
    by_id = {m.id: m for m in mentions}

    cat_ok = sum(by_id[mid].category == gi["category"] for mid, (_, gi, _) in pairs.items())
    stat_ok = sum(by_id[mid].status == gm["status"] for mid, (_, _, gm) in pairs.items())
    gold_triggers = sum(len(gm["triggers"]) for _, _, gm in pairs.values())
    trig_ok = 0
    for mid, (_, _, gm) in pairs.items():
        got = {t.deadline for t in by_id[mid].triggers}
        trig_ok += sum(t["deadline"] in got for t in gm["triggers"])
    quote_ok = sum(m.quote_valid for m in mentions)

    def ratio(a, b):
        return round(a / b, 3) if b else 1.0

    # identity: pairwise over matched mentions inside a project
    issue_of = {m.id: i.id for i in res.issues.values() for m in i.mentions}
    tp = fp = fn = 0
    for a, b in combinations(sorted(pairs), 2):
        if by_id[a].project != by_id[b].project:
            continue
        same_gold = pairs[a][0] == pairs[b][0]
        same_pred = issue_of[a] == issue_of[b]
        tp += same_gold and same_pred
        fp += same_pred and not same_gold
        fn += same_gold and not same_pred

    found_matches = {(res.issues[m.issue_id].gold_id, res.issues[m.prior_issue_id].gold_id) for m in res.matches}
    detail = [{"issue": e["issue"], "prior": e["prior"], "found": (e["issue"], e["prior"]) in found_matches}
              for e in gold["expected_cross_project_matches"]]
    no_match = set(gold["expected_no_cross_project_match"])
    false_pos = sum(res.issues[m.issue_id].gold_id in no_match for m in res.matches)

    res.evaluation.update({
        "extraction": {"mention_recall": ratio(n_pairs, gold_total), "mention_precision": ratio(n_pairs, len(mentions)),
                       "category_accuracy": ratio(cat_ok, n_pairs), "status_accuracy": ratio(stat_ok, n_pairs),
                       "trigger_date_accuracy": ratio(trig_ok, gold_triggers),
                       "quote_validity": ratio(quote_ok, len(mentions))},
        "identity": {"pairwise_precision": ratio(tp, tp + fp), "pairwise_recall": ratio(tp, tp + fn)},
        "cross_project": {"expected": len(detail), "found": sum(d["found"] for d in detail),
                          "false_positives": false_pos, "detail": detail},
        "lead_time": lead_time(res),
    })


def table(ev: dict) -> str:
    lines = [f"Source: {ev['source']}"]
    if "extraction" in ev:
        lines += [f"  {k:24} {v:.0%}" for k, v in ev["extraction"].items()]
        lines += [f"  {k:24} {v:.0%}" for k, v in ev["identity"].items()]
        cp = ev["cross_project"]
        lines.append(f"  cross-project found      {cp['found']} of {cp['expected']}, false positives {cp['false_positives']}")
        lines += [f"    {d['issue']} <- {d['prior']}: {'found' if d['found'] else 'MISSING'}" for d in cp["detail"]]
    lt = ev["lead_time"]
    gt = date.fromisoformat(lt["ground_truth_date"])
    lines.append(f"  Lead time for {lt['issue_id']} vs actual escalation {fmt(gt)}")
    for r in lt["rows"]:
        d = fmt(date.fromisoformat(r["date"])) if r["date"] else "none"
        lines.append(f"    {r['label']:24} {d:12} {r['days_earlier']} days earlier")
    lines.append("  Fallbacks: " + ("; ".join(ev["fallbacks"]) if ev["fallbacks"] else "none"))
    return "\n".join(lines)
