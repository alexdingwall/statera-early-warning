import { differenceInCalendarDays, format, parseISO } from "date-fns"

export const fmtDate = (d: string) => format(parseISO(d), "d MMM yyyy")
export const daysBetween = (a: string, b: string) => differenceInCalendarDays(parseISO(b), parseISO(a))
export const addDays = (d: string, n: number) => format(new Date(parseISO(d).getTime() + n * 864e5), "yyyy-MM-dd")

export function ageText(firstSeen: string, asOf: string): string {
  const days = Math.max(0, daysBetween(firstSeen, asOf))
  if (days < 7) return `open ${days} day${days === 1 ? "" : "s"}`
  const w = Math.floor(days / 7)
  return `open ${w} week${w === 1 ? "" : "s"}`
}

export const pct = (x: number) => `${Math.round(x * 100)}%`

export const categoryLabel = (c: string) => c.replace(/_/g, " ")

export const DOC_TYPE_LABEL: Record<string, string> = {
  weekly_report: "Weekly report",
  board_update: "Board update",
  site_visit: "Site visit",
  planning_status: "Planning status",
  procurement_issue: "Procurement issue",
  handover_status: "Handover status",
  commissioning_summary: "Commissioning summary",
  lessons_learned: "Lessons learned",
  correspondence_summary: "Correspondence summary",
}

export const RULE_WORDS: Record<string, string> = {
  PERSISTENCE: "Raised in reports in a row",
  TRIGGER: "Deadline set in the report",
  IMPACT: "Programme affected",
  PRIOR_INCIDENT: "Seen before on another project",
}

export const ruleWords = (rule: string, severity: string) =>
  rule === "PERSISTENCE" ? `Raised in ${severity === "red" ? 3 : 2} reports in a row` : RULE_WORDS[rule]

export const STATUS_WORDS: Record<string, string> = {
  open: "Open",
  resolved: "Resolved",
  materialised: "Has affected programme",
  occurred: "Past incident",
}

export const VERDICT_WORDS: Record<string, string> = {
  supported: "Supported",
  supported_with_caveat: "Supported, with a caveat",
  contradicted: "Contradicted",
  no_evidence: "No evidence",
}
