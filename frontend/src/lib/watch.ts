import type { Bundle, WatchNote } from "@/types"
import { categoryLabel, fmtDate } from "@/lib/format"

export interface WatchItem {
  note: WatchNote
  title: string
  history: { issueId: string; text: string }[]
  advice: string
}

const ADVICE: Record<string, string> = {
  procurement_supplier: "Ask for a written delivery date now, and have it re-confirmed at every report.",
  planning: "Ask for the outstanding submissions now and set an internal date ahead of any planning deadline.",
  site_access: "Check access with the supplier before delivery is booked.",
}
const PHRASE: Record<string, string> = { procurement_supplier: "a supplier delay", planning: "a planning delay", site_access: "a site access problem" }
const FALLBACK = "Agree a named contact and a written date early, and chase before the first report rather than after."

/** Watch notes live on asOf: an earlier incident elsewhere, and this project has not yet raised the same kind of issue. */
export const watchOn = (b: Bundle, asOf: string, project?: string): WatchItem[] =>
  b.watch
    .filter((n) => (!project || n.project === project) && n.from <= asOf && (!n.until || n.until > asOf))
    .map((note) => {
      const seen = note.incidents.filter((x) => x.date <= asOf)
      const label = (b.counterparties[note.counterparty]?.label ?? note.counterparty).replace(/\s*\(.*\)$/, "")
      return {
        note,
        title: `${label}: ${PHRASE[note.category] ?? `a ${categoryLabel(note.category)} issue`} ${seen.length === 1 ? "once before" : `${seen.length} times before`}`,
        history: seen.map((x) => {
          const issue = b.issues.find((i) => i.id === x.issue_id)!
          return { issueId: x.issue_id, text: `${issue.title} at ${x.project[0].toUpperCase()}${x.project.slice(1)} (${fmtDate(x.date)})` }
        }),
        advice: ADVICE[note.category] ?? FALLBACK,
      }
    })
