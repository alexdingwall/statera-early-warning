from dataclasses import dataclass, field
from datetime import date
from typing import Literal

from pydantic import BaseModel

Category = Literal["grid_connection", "planning", "procurement_supplier", "contractor_performance",
                   "site_access", "ground_conditions", "environmental", "weather",
                   "commissioning", "handover", "cost", "other"]
Status = Literal["open", "resolved", "materialised", "occurred"]
Impact = Literal["none_stated", "potential", "realised"]


# ---- LLM-facing schemas (dates as strings; converted and validated in code) ----

class LLMTrigger(BaseModel):
    condition_text: str
    deadline_date: str | None        # ISO yyyy-mm-dd or null


class LLMMention(BaseModel):
    title: str                       # max 10 words
    description: str                 # 1-2 sentences
    category: Category
    counterparty_role: str | None
    status: Status
    awaiting_third_party: bool
    chase_count: int | None
    programme_impact: Impact
    triggers: list[LLMTrigger]
    evidence_quote: str


class LLMProgramme(BaseModel):
    baseline_energisation: str | None
    forecast_energisation: str | None
    float_days: int | None


class LLMExtraction(BaseModel):
    mentions: list[LLMMention]
    programme: LLMProgramme | None


class IdentityJudgement(BaseModel):
    same: bool
    reason: str


class XPExplanation(BaseModel):
    explanation: str


class BoardClaimVerdict(BaseModel):
    verdict: Literal["supported", "supported_with_caveat", "contradicted", "no_evidence"]
    reason: str
    evidence_mention_ids: list[str]


# ---- Internal models ----

@dataclass
class MTrigger:
    condition_text: str
    deadline: date | None


@dataclass
class Mention:
    id: str
    doc_id: str
    date: date
    project: str
    title: str
    description: str
    category: str
    counterparty: str | None          # entity id
    status: str
    awaiting_third_party: bool
    chase_count: int | None
    programme_impact: str
    triggers: list[MTrigger] = field(default_factory=list)
    evidence_quote: str | None = None
    quote_span: tuple[int, int] | None = None
    quote_valid: bool = True
    gold_issue_id: str | None = None  # set in gold mode, used for evaluation


@dataclass
class ProgrammeSnapshot:
    project: str
    doc_id: str
    date: date
    baseline: date | None
    forecast: date | None
    float_days: int | None


@dataclass
class Issue:
    id: str
    project: str
    title: str
    description: str
    category: str
    counterparty: str | None
    first_seen: date
    mentions: list[Mention] = field(default_factory=list)
    gold_id: str | None = None


@dataclass
class Trigger:
    id: str
    issue_id: str
    declared_doc_id: str
    declared_on: date
    condition_text: str
    deadline: date | None


@dataclass
class Alert:
    id: str
    issue_id: str
    project: str
    rule: str
    severity: str
    fired_on: date
    title: str
    explanation: str
    stage_days: int | None = None
    used_mention_ids: list[str] = field(default_factory=list)   # internal, for the leakage test


@dataclass
class Match:
    id: str
    issue_id: str
    prior_issue_id: str
    score: float
    confidence: str
    reasons: list[str]
    explanation: str
