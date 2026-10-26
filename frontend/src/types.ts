export type ISODate = string // "2025-05-16"

export type Verdict = "supported" | "supported_with_caveat" | "contradicted" | "no_evidence"
export type Severity = "info" | "amber" | "red"
export type Rule = "PERSISTENCE" | "TRIGGER" | "IMPACT" | "PRIOR_INCIDENT"
export type EvidenceStatus = "on_track" | "watch" | "at_risk"
export type ReportedStatus = "on_programme" | "in_delay" | null

export interface Project {
  id: string
  name: string
  capacity: string | null
  pm: string | null
  baseline_energisation: ISODate
  actual_energisation?: ISODate | null
  commercial_date: ISODate | null
  commercial_label: string
  phases: { from: ISODate; phase: string }[]
}

export interface Doc {
  id: string
  project: string
  doc_type: string
  date: ISODate
  date_note?: string
  author: string | null
  title: string
  file: string
  text: string
  replay_excluded: boolean
  excluded_reason?: string
  uploaded?: boolean
}

export interface Mention {
  id: string
  doc_id: string
  date: ISODate
  status: string
  awaiting_third_party: boolean
  chase_count: number | null
  programme_impact: string
  description: string
  evidence_quote: string | null
  quote_span: [number, number] | null
  quote_valid: boolean
}

export interface Issue {
  id: string
  project: string
  title: string
  description: string
  category: string
  counterparty: string | null
  first_seen: ISODate
  mentions: Mention[]
  gold_id?: string
}

export interface Trigger {
  id: string
  issue_id: string
  declared_doc_id: string
  declared_on: ISODate
  condition_text: string
  deadline: ISODate | null
}

export interface Alert {
  id: string
  issue_id: string
  project: string
  rule: Rule
  severity: Severity
  fired_on: ISODate
  title: string
  explanation: string
  stage_days?: number
}

export interface Match {
  id: string
  issue_id: string
  prior_issue_id: string
  score: number
  confidence: "high" | "medium"
  reasons: string[]
  explanation: string
}

export interface Snapshot {
  project: string
  doc_id: string
  date: ISODate
  baseline: ISODate | null
  forecast: ISODate | null
  float_days: number | null
}

export interface StatusRow {
  project: string
  date: ISODate
  evidence_status: EvidenceStatus
  evidence_reasons: string[]
  reported_status: ReportedStatus
  reported_source_doc: string | null
  reported_quote: string | null
  divergent: boolean
}

export interface BoardClaim {
  id: string
  text: string
  span: [number, number]
  section: string
  verdict: Verdict
  reason: string
  evidence_mention_ids: string[]
  fallback?: boolean
}

export interface BoardCheck {
  doc_id: string
  as_of: ISODate
  claims: BoardClaim[]
  budget: {
    items: { label: string; amount: number }[]
    stated_total: number
    computed_total: number
    matches: boolean
    largest_label: string
    largest_share: number
    flag_vague: boolean
  }
}

export interface GroundTruth {
  id: string
  project: string
  issue_id: string
  date: ISODate
  label: string
  source_doc: string
}

export interface LeadTime {
  issue_id: string
  ground_truth_date: ISODate
  rows: { label: string; date: ISODate | null; days_earlier: number | null }[]
}

export interface Evaluation {
  source: "llm" | "gold"
  extraction?: {
    mention_recall: number
    mention_precision: number
    category_accuracy: number
    status_accuracy: number
    trigger_date_accuracy: number
    quote_validity: number
  }
  identity?: { pairwise_precision: number; pairwise_recall: number }
  cross_project?: {
    expected: number
    found: number
    false_positives: number
    detail: { issue: string; prior: string; found: boolean }[]
  }
  lead_time: LeadTime
  fallbacks: string[]
}

export interface Lesson {
  id: string
  source_doc: string
  title: string
  summary: string
  action: string
  owner: string
  status: string
  applies_to: { alert_rules?: string[]; counterparty?: string; phase_contains?: string }
}

export interface WatchNote {
  id: string
  project: string
  counterparty: string
  category: string
  from: string
  until: string | null
  incidents: { issue_id: string; project: string; date: string }[]
}

export interface Bundle {
  meta: {
    generated_at: string
    source: "llm" | "gold"
    model: string
    embed_model: string
    prompt_version: string
    window: { start: ISODate; end: ISODate }
  }
  projects: Project[]
  counterparties: Record<string, { label: string }>
  documents: Doc[]
  issues: Issue[]
  triggers: Trigger[]
  alerts: Alert[]
  matches: Match[]
  watch: WatchNote[]
  programme_snapshots: Snapshot[]
  status_timeline: StatusRow[]
  board_checks: BoardCheck[]
  ground_truth_events: GroundTruth[]
  lessons: Lesson[]
  evaluation: Evaluation
}
