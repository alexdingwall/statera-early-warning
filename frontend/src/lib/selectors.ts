import type { Alert, Bundle, Doc, Issue, Match, Mention, Project, Severity, StatusRow } from "@/types"

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

export const latestSnapshot = (b: Bundle, project: string, asOf: string) => {
  let s = null as Bundle["programme_snapshots"][number] | null
  for (const x of b.programme_snapshots) if (x.project === project && x.date <= asOf) if (!s || x.date >= s.date) s = x
  return s
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
