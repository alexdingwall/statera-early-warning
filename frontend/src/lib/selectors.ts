import type { Alert, Bundle, Doc, Issue, Lesson, Match, Mention, Project, Severity, StatusRow } from "@/types"

const SEV_RANK: Record<Severity, number> = { red: 3, amber: 2, info: 1 }
export const sevRank = (s: Severity) => SEV_RANK[s]

export const replayDocs = (b: Bundle) => b.documents.filter((d) => !d.replay_excluded)
export const docsUpTo = (b: Bundle, asOf: string, project?: string): Doc[] =>
  replayDocs(b).filter((d) => d.date <= asOf && (!project || d.project === project))

export const mentionsUpTo = (issue: Issue, asOf: string): Mention[] =>
  issue.mentions.filter((m) => m.date <= asOf)

export const issueStatusOn = (issue: Issue, asOf: string): string | null => {
  const ms = mentionsUpTo(issue, asOf)
  return ms.length ? ms[ms.length - 1].status : null
}

export const isOpenStatus = (s: string | null) => s === "open" || s === "materialised"

export const issuesSeen = (b: Bundle, asOf: string, project?: string) =>
  b.issues.filter((i) => i.first_seen <= asOf && (!project || i.project === project))

const issueMap = (b: Bundle) => new Map(b.issues.map((i) => [i.id, i]))

export const alertsFired = (b: Bundle, asOf: string, project?: string): Alert[] =>
  b.alerts.filter((a) => a.fired_on <= asOf && (!project || a.project === project))

export const activeAlertsOn = (b: Bundle, asOf: string, project?: string): Alert[] => {
  const issues = issueMap(b)
  return alertsFired(b, asOf, project).filter((a) => {
    const s = issueStatusOn(issues.get(a.issue_id)!, asOf)
    return s !== null && s !== "resolved"
  })
}

export const bySeverityThenNewest = (a: Alert, b: Alert) =>
  sevRank(b.severity) - sevRank(a.severity) || b.fired_on.localeCompare(a.fired_on)

export const alertsFiredOn = (b: Bundle, day: string) => b.alerts.filter((a) => a.fired_on === day)

export const statusOn = (b: Bundle, project: string, asOf: string): StatusRow | null => {
  let row: StatusRow | null = null
  for (const r of b.status_timeline) if (r.project === project && r.date <= asOf) row = r
  return row
}

export const matchesFor = (b: Bundle, issue: Issue, asOf: string): Match[] => {
  const issues = issueMap(b)
  return b.matches.filter((m) => {
    if (m.issue_id !== issue.id) return false
    const prior = issues.get(m.prior_issue_id)
    return !!prior && prior.first_seen <= asOf && issue.first_seen <= asOf
  })
}

export const phaseOn = (p: Project, asOf: string): string | null => {
  let phase: string | null = null
  for (const ph of p.phases) if (ph.from <= asOf) phase = ph.phase
  return phase
}

/** Latest stated value of each programme field on or before asOf (a board paper may state a forecast but no float). */
export const latestSnapshot = (b: Bundle, project: string, asOf: string) => {
  const snaps = b.programme_snapshots.filter((x) => x.project === project && x.date <= asOf).sort((x, y) => x.date.localeCompare(y.date))
  if (!snaps.length) return null
  const last = <K extends "baseline" | "forecast" | "float_days">(k: K) => [...snaps].reverse().find((x) => x[k] !== null)?.[k] ?? null
  return { baseline: last("baseline"), forecast: last("forecast"), float_days: last("float_days"), date: snaps[snaps.length - 1].date }
}

export const docDates = (b: Bundle) => [...new Set(replayDocs(b).map((d) => d.date))].sort()

export const triggersFor = (b: Bundle, issueId: string, asOf: string) =>
  b.triggers.filter((t) => t.issue_id === issueId && t.declared_on <= asOf)

export const docById = (b: Bundle, id: string) => b.documents.find((d) => d.id === id)!

export interface ChangeEvent {
  date: string
  kind: "first_seen" | "alert" | "resolved"
  text: string
  issueId: string
  project: string
  severity?: Severity
}

export const latestChanges = (b: Bundle, asOf: string, days = 14, max = 6): ChangeEvent[] => {
  const start = new Date(new Date(asOf).getTime() - days * 864e5).toISOString().slice(0, 10)
  const inWin = (d: string) => d >= start && d <= asOf
  const out: ChangeEvent[] = []
  for (const i of b.issues) {
    if (inWin(i.first_seen)) out.push({ date: i.first_seen, kind: "first_seen", text: `New issue: ${i.title}`, issueId: i.id, project: i.project })
    for (const m of i.mentions) {
      if (m.status === "resolved" && inWin(m.date)) out.push({ date: m.date, kind: "resolved", text: `Resolved: ${i.title}`, issueId: i.id, project: i.project })
    }
  }
  for (const a of b.alerts) {
    if (inWin(a.fired_on)) out.push({ date: a.fired_on, kind: "alert", text: `Alert: ${a.title}`, issueId: a.issue_id, project: a.project, severity: a.severity })
  }
  return out.sort((x, y) => y.date.localeCompare(x.date) || x.text.localeCompare(y.text)).slice(0, max)
}

// ---------- Headline status and lessons ----------

export interface Reason { alert: Alert; issue: Issue }

/** Active red/amber alerts, one per issue (the most severe, then newest), most urgent first. */
export const topReasons = (b: Bundle, asOf: string, project: string): Reason[] => {
  const issues = issueMap(b)
  const seen = new Set<string>()
  const out: Reason[] = []
  for (const a of activeAlertsOn(b, asOf, project).filter((x) => x.severity !== "info").sort(bySeverityThenNewest)) {
    if (seen.has(a.issue_id)) continue
    seen.add(a.issue_id)
    out.push({ alert: a, issue: issues.get(a.issue_id)! })
  }
  return out
}

export interface Headline { tone: "red" | "amber" | "green" | "grey"; text: string; detail: string | null }

export const headlineFor = (b: Bundle, project: string, asOf: string): Headline => {
  if (docsUpTo(b, asOf, project).length === 0) return { tone: "grey", text: "No documents yet", detail: null }
  const st = statusOn(b, project, asOf)
  const reasons = topReasons(b, asOf, project)
  const lead = reasons[0]
  const more = reasons.length > 1 ? ` and ${reasons.length - 1} more` : ""
  const word = st?.evidence_status === "at_risk" ? "At risk" : st?.evidence_status === "watch" ? "Watch" : "On track"
  const tone = st?.evidence_status === "at_risk" ? "red" : st?.evidence_status === "watch" ? "amber" : "green"
  const text = lead ? `${word}: ${lead.issue.title}${more}` : `${word}: no active red or amber alerts`
  let detail: string | null = null
  if (st?.divergent) detail = "Reported on programme; evidence says at risk."
  else if (st?.reported_status === "in_delay" && st.evidence_status !== "on_track") detail = "Report and evidence agree: programme under pressure."
  return { tone, text, detail }
}

export interface LessonHit { lesson: Lesson; items: { project: string; issue?: Issue; why: string }[] }

/** Lessons that existed by asOf, with where they apply on that date (outside their source project). */
export const lessonsAsOf = (b: Bundle, asOf: string, project?: string): LessonHit[] => {
  const issues = issuesSeen(b, asOf)
  const active = activeAlertsOn(b, asOf).filter((a) => a.severity !== "info")
  return b.lessons
    .filter((l) => docById(b, l.source_doc).date <= asOf)
    .map((lesson) => {
      const srcProject = docById(b, lesson.source_doc).project
      const a = lesson.applies_to
      const items: LessonHit["items"] = []
      if (a.alert_rules) {
        const seen = new Set<string>()
        for (const al of active.filter((x) => a.alert_rules!.includes(x.rule) && x.project !== srcProject).sort(bySeverityThenNewest)) {
          if (seen.has(al.issue_id)) continue
          seen.add(al.issue_id)
          items.push({ project: al.project, issue: issues.find((i) => i.id === al.issue_id), why: `${al.rule === "PERSISTENCE" ? "Raised repeatedly" : "Deadline set in the report"}, still open` })
        }
      }
      if (a.counterparty) {
        for (const i of issues.filter((x) => x.counterparty === a.counterparty && x.project !== srcProject && isOpenStatus(issueStatusOn(x, asOf)))) {
          items.push({ project: i.project, issue: i, why: "Same counterparty as the earlier incident" })
        }
      }
      if (a.phase_contains) {
        for (const p of b.projects) {
          if (p.id !== srcProject && (phaseOn(p, asOf) ?? "").includes(a.phase_contains)) items.push({ project: p.id, why: `Now in ${phaseOn(p, asOf)?.toLowerCase()}` })
        }
      }
      return { lesson, items: project ? items.filter((x) => x.project === project) : items }
    })
}

// ---------- What is new ----------

/** The report date before the latest one on or before asOf: "since the previous report". */
export const previousReportDate = (b: Bundle, asOf: string): string | null => {
  const dates = docDates(b).filter((d) => d <= asOf)
  return dates.length >= 2 ? dates[dates.length - 2] : null
}

export interface NewItem { date: string; project: string; issueId: string; text: string; kind: "issue" | "warning" | "resolved"; severity?: Severity }

/** Plain-words changes after the previous report and up to asOf: new issues, new warnings, resolutions. */
export const changesSince = (b: Bundle, asOf: string): { from: string | null; items: NewItem[] } => {
  const from = previousReportDate(b, asOf)
  const inWin = (d: string) => (!from || d > from) && d <= asOf
  const out: NewItem[] = []
  for (const i of b.issues) {
    if (inWin(i.first_seen)) out.push({ date: i.first_seen, project: i.project, issueId: i.id, kind: "issue", text: `New issue: ${i.title}` })
    for (const m of i.mentions) if (m.status === "resolved" && inWin(m.date)) out.push({ date: m.date, project: i.project, issueId: i.id, kind: "resolved", text: `Resolved: ${i.title}` })
  }
  for (const a of b.alerts) {
    if (a.severity !== "info" && inWin(a.fired_on)) out.push({ date: a.fired_on, project: a.project, issueId: a.issue_id, kind: "warning", severity: a.severity, text: `New warning on ${a.title}` })
  }
  return { from, items: out.sort((x, y) => y.date.localeCompare(x.date) || x.text.localeCompare(y.text)) }
}
