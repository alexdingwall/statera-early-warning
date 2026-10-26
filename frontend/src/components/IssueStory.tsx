import { Flag } from "lucide-react"
import { useStore } from "@/store"
import { daysBetween, fmtDate, ruleWords, STATUS_WORDS } from "@/lib/format"
import { SeverityIcon } from "@/components/ui-bits"
import type { Alert, Doc, Issue, Trigger } from "@/types"

const STAGE: Record<number, string> = { 56: "8 weeks before the report's deadline", 28: "4 weeks before the report's deadline", 0: "the report's deadline has been reached" }

interface Row { date: string; order: number; key: string; icon: React.ReactNode; title: string; detail?: string; note?: string; future?: boolean; onClick?: () => void }

/** What happened on this issue, in date order and plain words: what each report said, the warnings it raised, and the deadline ahead. */
export function IssueStory({ issue, asOf, alerts, triggers, docs }: { issue: Issue; asOf: string; alerts: Alert[]; triggers: Trigger[]; docs: Doc[] }) {
  const bundle = useStore((s) => s.bundle)!
  const gt = useStore((s) => s.groundTruth)
  const openDrawer = useStore((s) => s.openDrawer)
  const rows: Row[] = []

  for (const m of issue.mentions.filter((x) => x.date <= asOf)) {
    const d = docs.find((x) => x.id === m.doc_id)
    const said = (m.evidence_quote || m.description || "").replace(/\*\*/g, "").trim()
    const note = [m.status !== "open" ? STATUS_WORDS[m.status] : null, m.chase_count ? `chased ${m.chase_count} ${m.chase_count === 1 ? "time" : "times"}` : null].filter(Boolean).join(" · ")
    rows.push({
      date: m.date, order: 0, key: m.id, icon: <span className="size-2.5 rounded-full bg-blue-500" />, title: d?.title ?? m.doc_id,
      detail: said ? `“${said}”` : undefined, note: note || undefined,
      onClick: () => openDrawer({ docId: m.doc_id, span: m.quote_span }),
    })
  }
  for (const a of alerts) {
    if (a.rule === "PRIOR_INCIDENT") continue   // shown in "Last time" above
    const label = a.rule === "TRIGGER" && a.stage_days !== undefined ? STAGE[a.stage_days] ?? ruleWords(a.rule, a.severity) : ruleWords(a.rule, a.severity)
    rows.push({ date: a.fired_on, order: 1, key: a.id, icon: <SeverityIcon severity={a.severity} size={14} />, title: `Warning: ${label}` })
  }
  const seen = new Set<string>()
  for (const t of triggers) {
    if (!t.deadline || seen.has(t.deadline)) continue
    seen.add(t.deadline)
    const left = daysBetween(asOf, t.deadline)
    rows.push({
      date: t.deadline, order: 2, key: t.id, icon: <Flag size={13} className="text-navy-600" aria-hidden />, future: left > 0,
      title: `Deadline set in the report: ${left > 0 ? `${left} days from now` : left === 0 ? "today" : `passed ${-left} days ago`}`,
      note: `Stated in the ${fmtDate(t.declared_on)} report`,
    })
  }
  const gtEvent = gt ? bundle.ground_truth_events.find((e) => e.issue_id === issue.id && e.date <= asOf) : undefined
  if (gtEvent) rows.push({ date: gtEvent.date, order: 3, key: gtEvent.id, icon: <Flag size={13} className="text-navy-900" aria-hidden />, title: `What actually happened: ${gtEvent.label}` })
  rows.sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order)

  const firstFuture = rows.findIndex((r) => r.date > asOf)
  return (
    <ol className="space-y-1.5">
      {rows.map((r, n) => {
        const body = (
          <>
            <span className="num w-[84px] shrink-0 text-muted-ink">{fmtDate(r.date)}</span>
            <span className="mt-[3px] flex w-4 shrink-0 justify-center">{r.icon}</span>
            <span className="min-w-0">
              <span className="font-medium">{r.title}</span>
              {r.note && <span className="text-[12px] text-muted-ink"> · {r.note}</span>}
              {r.detail && <span className="block text-[12px] text-muted-ink">{r.detail}</span>}
            </span>
          </>
        )
        return (
          <li key={r.key} className={r.future ? "opacity-70" : undefined}>
            {n === firstFuture && (
              <div className="my-2 flex items-center gap-2 text-[12px] font-medium text-muted-ink" role="separator">
                <span className="h-px flex-1 bg-line" />As of {fmtDate(asOf)}: still ahead<span className="h-px flex-1 bg-line" />
              </div>
            )}
            {r.onClick
              ? <button onClick={r.onClick} className="flex w-full gap-2 rounded-sm px-1 text-left hover:bg-bg">{body}</button>
              : <div className="flex gap-2 px-1">{body}</div>}
          </li>
        )
      })}
    </ol>
  )
}
