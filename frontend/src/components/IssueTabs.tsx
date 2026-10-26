import { useEffect, useState } from "react"
import { Check } from "lucide-react"
import { useStore } from "@/store"
import { fmtDate, STATUS_WORDS } from "@/lib/format"
import { matchesFor, mentionsUpTo, triggersFor } from "@/lib/selectors"
import { Pager, Pill } from "@/components/ui-bits"
import { IssueStory } from "@/components/IssueStory"
import { cn } from "@/lib/utils"
import type { Issue } from "@/types"

type Tab = "story" | "evidence" | "seen"

/** The record behind a decision: what happened, the source quotes, and similar earlier incidents. */
export function IssueTabs({ issue }: { issue: Issue }) {
  const bundle = useStore((s) => s.bundle)!
  const asOf = useStore((s) => s.asOf)
  const openDrawer = useStore((s) => s.openDrawer)
  const [tab, setTab] = useState<Tab>("story")
  const ms = mentionsUpTo(issue, asOf)
  const alerts = bundle.alerts.filter((a) => a.issue_id === issue.id && a.fired_on <= asOf).sort((a, b) => a.fired_on.localeCompare(b.fired_on))
  const triggers = triggersFor(bundle, issue.id, asOf)
  const matches = matchesFor(bundle, issue, asOf)
  const docs = bundle.documents
  const docOf = (id: string) => docs.find((d) => d.id === id)!
  const [evPage, setEvPage] = useState(0)
  useEffect(() => setEvPage(0), [issue.id])
  const evRows = [...ms].reverse()
  const EV = 3

  const tabs: { id: Tab; label: string; n: number }[] = [
    { id: "story", label: "What happened", n: ms.length + alerts.length },
    { id: "evidence", label: "Evidence", n: ms.length },
    { id: "seen", label: "Similar earlier incidents", n: matches.length },
  ]

  return (
    <>
      <div role="tablist" className="sticky bottom-0 z-10 flex shrink-0 gap-1 border-y border-line bg-surface shadow-[0_-6px_8px_-6px_rgba(15,31,52,0.15)]">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={cn("-mb-px border-b-2 px-3 py-1.5 text-[13px]", tab === t.id ? "border-blue-500 font-medium text-ink" : "border-transparent text-muted-ink hover:text-ink")}>
            {t.label} <span className="num text-[12px] text-muted-ink">{t.n}</span>
          </button>
        ))}
      </div>
      <div className="shrink-0 py-1 text-[13px]">
        {tab === "story" && <IssueStory issue={issue} asOf={asOf} alerts={alerts} triggers={triggers} docs={docs} />}
        {tab === "evidence" && (
          <>
            <ul className="space-y-1">
              {evRows.slice(evPage * EV, evPage * EV + EV).map((m) => (
                <li key={m.id}>
                  <button onClick={() => openDrawer({ docId: m.doc_id, span: m.quote_span })} className="grid w-full grid-cols-[84px_1fr] gap-x-3 rounded-sm px-1 py-0.5 text-left hover:bg-bg">
                    <span className="num text-muted-ink">{fmtDate(m.date)}</span>
                    <span className="min-w-0">
                      <span className="font-medium">{docOf(m.doc_id).title}</span>
                      <span className="text-muted-ink"> · {STATUS_WORDS[m.status] ?? m.status}</span>
                      {(m.evidence_quote || m.description) && <span className="block text-[12px] text-muted-ink">{m.evidence_quote ? `“${m.evidence_quote.replace(/\*\*/g, "")}”` : m.description}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {evRows.length > EV && <Pager page={evPage} pages={Math.ceil(evRows.length / EV)} onPage={setEvPage} total={evRows.length} label="mentions" />}
          </>
        )}
        {tab === "seen" && <SeenBefore issue={issue} />}
      </div>
    </>
  )
}

function readFb(id: string): string | null {
  try { return localStorage.getItem(`ew-feedback-${id}`) } catch { return null }
}
function writeFb(id: string, v: string) {
  try { localStorage.setItem(`ew-feedback-${id}`, v) } catch { /* storage unavailable */ }
}

function SeenBefore({ issue }: { issue: Issue }) {
  const bundle = useStore((s) => s.bundle)!
  const asOf = useStore((s) => s.asOf)
  const matches = matchesFor(bundle, issue, asOf)
  const [fb, setFb] = useState<Record<string, string | null>>({})
  const get = (id: string) => (id in fb ? fb[id] : readFb(id))
  if (matches.length === 0) return <p className="text-muted-ink">Nothing similar on another project as of {fmtDate(asOf)}.</p>
  return (
    <div>
      <ul className="space-y-2">
        {matches.slice(0, 2).map((m) => {
          const prior = bundle.issues.find((i) => i.id === m.prior_issue_id)!
          const v = get(m.id)
          return (
            <li key={m.id}>
              <div className="flex items-center gap-2">
                <span className="font-medium">{prior.title}</span>
                <span className="capitalize text-muted-ink">({prior.project})</span>
                <Pill tone={m.confidence === "high" ? "info" : "grey"}>{m.confidence === "high" ? "High confidence" : "Medium confidence"}</Pill>
              </div>
              <div className="my-0.5 flex flex-wrap gap-1">
                {m.reasons.map((r) => <span key={r} className="rounded-sm bg-bg px-1.5 py-0.5 text-[11px] text-muted-ink">{r}</span>)}
              </div>
              <div className="flex items-center gap-2">
                <span className="flex-1 text-[12px] text-muted-ink">{m.explanation}</span>
                {(["relevant", "not relevant"] as const).map((k) => (
                  <button key={k} aria-pressed={v === k}
                    onClick={() => { writeFb(m.id, k); setFb({ ...fb, [m.id]: k }) }}
                    className={cn("shrink-0 rounded-md border px-2 py-0.5 text-[12px]", v === k ? "border-navy-900 bg-navy-900 text-white" : "border-line hover:bg-bg")}>
                    {v === k && <Check size={12} className="mr-0.5 inline" aria-hidden />}{k === "relevant" ? "Relevant" : "Not relevant"}
                  </button>
                ))}
              </div>
            </li>
          )
        })}
      </ul>
      <p className="mt-1 text-[11px] text-muted-ink">Feedback would train the matcher in a full version.</p>
    </div>
  )
}
