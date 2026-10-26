/**
 * The action queue: one decision per issue that has an active red or amber alert.
 * Everything here is derived from the bundle and the as-of date by plain rules (no model text),
 * so each recommendation can be traced to the data behind it.
 */
import { daysBetween, fmtDate } from "@/lib/format"
import {
  activeAlertsOn, docById, isOpenStatus, issuesSeen, issueStatusOn, latestSnapshot, lessonsAsOf, matchesFor, mentionsUpTo, sevRank, triggersFor,
} from "@/lib/selectors"
import type { Alert, Bundle, Issue, Match } from "@/types"

/** Act now: affecting the programme or a stated deadline within 30 days. Prepare: warned but not yet urgent. Watch: open, no warning. Past: closed or a past incident. */
export type Tier = "now" | "prepare" | "watch" | "past"
export const TIER_WORDS: Record<Tier, string> = { now: "Act now", prepare: "Prepare", watch: "Keep an eye on", past: "Past incidents" }
const TIER_ORDER: Tier[] = ["now", "prepare", "watch", "past"]
const NOW_WITHIN_DAYS = 30

export interface ActionItem {
  tier: Tier
  issue: Issue
  project: string
  severity: "red" | "amber" | "info"
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
  /** Related issues from the same report, folded into this one. */
  also: { id: string; title: string }[]
  /** True when the issue has already affected the programme: a recovery decision, not a prevention one. */
  affecting: boolean
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function buildActions(b: Bundle, asOf: string): ActionItem[] {
  const items: (ActionItem & { urgency: number; affecting: boolean })[] = []
  const lessons = lessonsAsOf(b, asOf)

  for (const project of b.projects) {
    const active = activeAlertsOn(b, asOf, project.id).filter((a) => a.severity !== "info")
    for (const issue of issuesSeen(b, asOf, project.id)) {
      const alerts = active.filter((a) => a.issue_id === issue.id)
      const severity = alerts.some((a) => a.severity === "red") ? "red" : alerts.length ? "amber" : "info"
      const status = issueStatusOn(issue, asOf)
      const ms = mentionsUpTo(issue, asOf)
      const latest = ms[ms.length - 1]

      // trailing run of open mentions
      let n = 0
      while (n < ms.length && ms[ms.length - 1 - n].status === "open") n++
      const firstOpen = n ? ms[ms.length - n].date : issue.first_seen
      const counts = ms.map((m) => m.chase_count).filter((c): c is number => c !== null)
      const chase = counts.length ? Math.max(...counts) : null   // the highest count any report states; later reports may only say "chased again"

      const cpLabel = issue.counterparty && issue.counterparty !== "internal" ? (b.counterparties[issue.counterparty]?.label ?? issue.counterparty).replace(/\s*\(.*\)$/, "") : null
      const waiting = !!latest?.awaiting_third_party && !!cpLabel

      const trig = triggersFor(b, issue.id, asOf).filter((t) => t.deadline)
      const upcoming = trig.filter((t) => t.deadline! >= asOf).sort((x, y) => x.deadline!.localeCompare(y.deadline!))[0]
      const passed = trig.filter((t) => t.deadline! < asOf).sort((x, y) => y.deadline!.localeCompare(x.deadline!))[0]
      const impact = alerts.find((a) => a.rule === "IMPACT")
      const decideBy = impact ? null : upcoming?.deadline ?? null
      const daysLeft = decideBy ? daysBetween(asOf, decideBy) : null

      const cpName = cpLabel && /^[A-Z][a-z]/.test(cpLabel) ? cpLabel.charAt(0).toLowerCase() + cpLabel.slice(1) : cpLabel   // "civils contractor", but "DNO"
      const target = cpName ? `Escalate formally to ${cpName}` : "Assign an owner and a date"
      let action: string
      if (impact) action = `Agree a recovery plan${cpLabel ? ` with ${cpLabel}` : ""} and update the forecast now. This issue has already affected the programme.`
      else if (upcoming) action = `${target} before ${fmtDate(upcoming.deadline!)} (${daysLeft === 0 ? "due today" : `${daysLeft} days left`}, from the ${fmtDate(upcoming.declared_on)} report).`
      else if (passed) action = `${target} now. The deadline set in the report (${fmtDate(passed.deadline!)}) has passed and this is still open.`
      else action = `${cpName ? `Chase ${cpName} for a written date and a named contact` : "Assign an owner and a date"}. It has been raised in ${Math.max(n, 2)} reports and is still open.`

      const why: string[] = []
      if (n >= 2 && !impact) why.push(`Raised in ${n} reports in a row since ${fmtDate(firstOpen)}.`)
      if (chase !== null) why.push(`At least ${chase} ${chase === 1 ? "chase" : "chases"} recorded${waiting ? `, waiting on ${cpLabel}` : ""}.`)
      const t = upcoming ?? passed
      if (t) why.push(`The ${fmtDate(t.declared_on)} report said: “${t.condition_text.replace(/[.\s]+$/, "")}”.`)
      if (impact) why.push(`Already affecting the programme (${docById(b, (ms.find((m) => m.date === impact.fired_on) ?? latest).doc_id).title}, ${fmtDate(impact.fired_on)}).`)
      if (!why.length) why.push(alerts[0]?.explanation ?? "Open, and no warning has been raised on it yet.")

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

      const open = isOpenStatus(status)
      const tier: Tier = !open ? "past" : !alerts.length ? "watch"
        : impact || passed && !upcoming || (daysLeft !== null && daysLeft <= NOW_WITHIN_DAYS) ? "now" : "prepare"
      if (tier === "watch") action = "Nothing to decide yet. Keep an eye on it."
      if (tier === "past") action = "Closed. Kept so other projects can learn from it."
      const urgency = passed && !upcoming && !impact ? 0 : daysLeft ?? 30   // no stated deadline: act soon, after anything dated
      items.push({
        tier, also: [], affecting: !!impact, issue, project: project.id, severity, action, owner: project.pm ?? "Project delivery", decideBy, daysLeft,
        why, stakes, lastTime, alerts, urgency,
      })
    }
  }

  const ranked = items.sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier)
    // Within a tier: still preventable first, then problems already hurting the programme; then severity, then nearest date.
    || Number(a.affecting) - Number(b.affecting) || sevRank(b.severity) - sevRank(a.severity) || a.urgency - b.urgency || a.issue.first_seen.localeCompare(b.issue.first_seen))

  // The model sometimes splits one report into several issues. Fold them into one item: related warned issues from the
  // same counterparty and report, and open issues without a warning when they are the same kind of problem.
  const kept: ActionItem[] = []
  for (const it of ranked) {
    const cp = it.issue.counterparty
    const lead = cp && cp !== "internal" && (it.tier === "now" || it.tier === "prepare" || it.tier === "watch")
      ? kept.find((k) => (k.tier === "now" || k.tier === "prepare") && k.project === it.project && k.issue.counterparty === cp && k.issue.first_seen === it.issue.first_seen
        && (it.tier !== "watch" || k.issue.category === it.issue.category))
      : undefined
    if (lead) { lead.also.push({ id: it.issue.id, title: it.issue.title }); lead.why.push(`Also recorded in the same report: ${it.issue.title}.`) }
    else kept.push(it)
  }
  return kept
}

export type ActionState = "escalated" | "acknowledged" | "snoozed"
export const STATE_WORDS: Record<ActionState, string> = { escalated: "Escalated", acknowledged: "Acknowledged", snoozed: "Snoozed" }
