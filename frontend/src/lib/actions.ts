/**
 * The action queue: one decision per issue that has an active red or amber alert.
 * Everything here is derived from the bundle and the as-of date by plain rules (no model text),
 * so each recommendation can be traced to the data behind it.
 */
import { daysBetween, fmtDate } from "@/lib/format"
import {
  activeAlertsOn, docById, issueStatusOn, latestSnapshot, lessonsAsOf, matchesFor, mentionsUpTo, sevRank, topReasons, triggersFor,
} from "@/lib/selectors"
import type { Alert, Bundle, Issue, Match } from "@/types"

export interface ActionItem {
  issue: Issue
  project: string
  severity: "red" | "amber"
  /** Plain-English headline of what to do, with the date it needs doing by. */
  action: string
  owner: string | null
  decideBy: string | null
  daysLeft: number | null
  why: string[]
  stakes: string[]
  lastTime: {
    kind: "incident" | "lesson"
    text: string
    lesson: string | null
    /** The earlier issue, so the UI can link to it, and what was recorded about it and when. */
    prior?: { id: string; project: string; events: { date: string; docId: string; docTitle: string; status: string; span: [number, number] | null }[] }
  } | null
  alerts: Alert[]
  /** True when the issue has already affected the programme: a recovery decision, not a prevention one. */
  affecting: boolean
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function buildActions(b: Bundle, asOf: string): ActionItem[] {
  const items: (ActionItem & { urgency: number; affecting: boolean })[] = []
  const lessons = lessonsAsOf(b, asOf)

  for (const project of b.projects) {
    for (const { issue } of topReasons(b, asOf, project.id)) {
      const alerts = activeAlertsOn(b, asOf, project.id).filter((a) => a.issue_id === issue.id && a.severity !== "info")
      const severity = alerts.some((a) => a.severity === "red") ? "red" : "amber"
      const ms = mentionsUpTo(issue, asOf)
      const latest = ms[ms.length - 1]

      // trailing run of open mentions
      let n = 0
      while (n < ms.length && ms[ms.length - 1 - n].status === "open") n++
      const firstOpen = n ? ms[ms.length - n].date : issue.first_seen
      const chase = [...ms].reverse().find((m) => m.chase_count !== null)?.chase_count ?? null

      const cpLabel = issue.counterparty && issue.counterparty !== "internal" ? (b.counterparties[issue.counterparty]?.label ?? issue.counterparty).replace(/\s*\(.*\)$/, "") : null
      const waiting = !!latest?.awaiting_third_party && !!cpLabel

      const trig = triggersFor(b, issue.id, asOf).filter((t) => t.deadline)
      const upcoming = trig.filter((t) => t.deadline! >= asOf).sort((x, y) => x.deadline!.localeCompare(y.deadline!))[0]
      const passed = trig.filter((t) => t.deadline! < asOf).sort((x, y) => y.deadline!.localeCompare(x.deadline!))[0]
      const impact = alerts.find((a) => a.rule === "IMPACT")
      const decideBy = impact ? null : upcoming?.deadline ?? null
      const daysLeft = decideBy ? daysBetween(asOf, decideBy) : null

      const target = cpLabel ? `Escalate formally to ${cpLabel}` : "Assign an owner and a date"
      let action: string
      if (impact) action = `Agree a recovery plan${cpLabel ? ` with ${cpLabel}` : ""} and update the forecast now. This issue has already affected the programme.`
      else if (upcoming) action = `${target} before ${fmtDate(upcoming.deadline!)} (${daysLeft} days left).`
      else if (passed) action = `${target} now. The deadline set in the report (${fmtDate(passed.deadline!)}) has passed and this is still open.`
      else action = `${target}. It has been raised in ${Math.max(n, 2)} reports and is still open.${cpLabel ? " Ask for a written answer and a named contact." : ""}`

      const why: string[] = []
      if (n >= 2 && !impact) why.push(`Raised in ${n} reports in a row since ${fmtDate(firstOpen)}.`)
      if (chase !== null) why.push(`${chase} ${chase === 1 ? "chase" : "chases"} recorded${waiting ? `, waiting on ${cpLabel}` : ""}.`)
      const t = upcoming ?? passed
      if (t) why.push(`The ${fmtDate(t.declared_on)} report said: “${t.condition_text}”.`)
      if (impact) why.push(`Already affecting the programme (${docById(b, latest.doc_id).title}, ${fmtDate(impact.fired_on)}).`)
      if (!why.length) why.push(alerts[0].explanation)

      const snap = latestSnapshot(b, project.id, asOf)
      const stakes: string[] = []
      if (snap?.float_days != null) stakes.push(`Float: ${snap.float_days} ${snap.float_days === 1 ? "day" : "days"}`)
      if (snap?.forecast) {
        const slip = snap.baseline ? daysBetween(snap.baseline, snap.forecast) : 0
        stakes.push(`Energisation forecast ${fmtDate(snap.forecast)}${slip > 0 ? ` (${slip} days late)` : snap.baseline ? ", on baseline" : ""}`)
      }
      if (project.commercial_date) stakes.push(`${cap(project.commercial_label.toLowerCase())} ${fmtDate(project.commercial_date)} (${daysBetween(asOf, project.commercial_date)} days)`)
      else if (project.id === "drumgarve") stakes.push(project.commercial_label)

      const m: Match | undefined = matchesFor(b, issue, asOf)[0]
      const prior = m ? b.issues.find((i) => i.id === m.prior_issue_id) : undefined
      const hit = lessons.find((l) => l.items.some((x) => x.issue?.id === issue.id))
      let lastTime: ActionItem["lastTime"] = null
      if (prior && m) lastTime = {
        kind: "incident",
        prior: {
          id: prior.id, project: prior.project,
          events: mentionsUpTo(prior, asOf).map((x) => ({ date: x.date, docId: x.doc_id, docTitle: docById(b, x.doc_id).title, status: x.status, span: x.quote_span })),
        },
        text: `${prior.title} at ${cap(prior.project)} (${fmtDate(prior.first_seen)}). ${m.explanation}`,
        lesson: hit ? `Agreed afterwards: ${hit.lesson.action.toLowerCase()} (owner ${hit.lesson.owner}). Status: ${hit.lesson.status.toLowerCase()}.` : null,
      }
      else if (hit) lastTime = { kind: "lesson", text: `${hit.lesson.title}. ${hit.lesson.summary}`, lesson: `Agreed afterwards: ${hit.lesson.action.toLowerCase()} (owner ${hit.lesson.owner}). Status: ${hit.lesson.status.toLowerCase()}.` }

      const urgency = passed && !upcoming && !impact ? 0 : daysLeft ?? 30   // no stated deadline: act soon, after anything dated
      items.push({
        affecting: !!impact, issue, project: project.id, severity, action, owner: project.pm ?? "Project delivery", decideBy, daysLeft,
        why, stakes, lastTime, alerts, urgency,
      })
    }
  }

  return items
    .filter((i) => issueStatusOn(i.issue, asOf) !== "resolved")
    // Still preventable first, then problems already hurting the programme; then severity, then nearest date.
    .sort((a, b) => Number(a.affecting) - Number(b.affecting) || sevRank(b.severity) - sevRank(a.severity) || a.urgency - b.urgency || a.issue.first_seen.localeCompare(b.issue.first_seen))
}

export type ActionState = "escalated" | "acknowledged" | "snoozed"
export const STATE_WORDS: Record<ActionState, string> = { escalated: "Escalated", acknowledged: "Acknowledged", snoozed: "Snoozed" }
