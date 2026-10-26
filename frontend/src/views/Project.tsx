import { useEffect, useMemo, useState } from "react"
import { Check } from "lucide-react"
import { useParams, useSearchParams } from "react-router-dom"
import { useStore } from "@/store"
import { ageText, categoryLabel, daysBetween, fmtDate, ruleWords, STATUS_WORDS } from "@/lib/format"
import { activeAlertsOn, bySeverityThenNewest, docsUpTo, isOpenStatus, issueStatusOn, issuesSeen, latestSnapshot, matchesFor, mentionsUpTo, phaseOn, sevRank, statusOn, triggersFor } from "@/lib/selectors"
import { EvidencePill, Pager, Panel, Pill, ReportedPill, SeverityIcon, SeverityPill } from "@/components/ui-bits"
import { LessonsView } from "@/views/Lessons"
import { IssueTimeline } from "@/components/IssueTimeline"
import { cn } from "@/lib/utils"
import type { Issue } from "@/types"

const PAGE = 8
type Tab = "evidence" | "alerts" | "seen" | "triggers"

export function Project() {
  const { id } = useParams()
  const bundle = useStore((s) => s.bundle)!
  const asOf = useStore((s) => s.asOf)
  const [params, setParams] = useSearchParams()
  const [filter, setFilter] = useState<"open" | "all">("open")
  const [page, setPage] = useState(0)
  const [tab, setTab] = useState<Tab>("evidence")

  const project = bundle.projects.find((p) => p.id === id)
  const docs = docsUpTo(bundle, asOf, id)
  const issues = useMemo(() => issuesSeen(bundle, asOf, id), [bundle, asOf, id])
  const alerts = activeAlertsOn(bundle, asOf, id)

  const topSev = (i: Issue) => Math.max(0, ...alerts.filter((a) => a.issue_id === i.id).map((a) => sevRank(a.severity)))
  const sorted = useMemo(
    () => issues
      .filter((i) => filter === "all" || isOpenStatus(issueStatusOn(i, asOf)))
      .sort((a, b) => topSev(b) - topSev(a) || a.first_seen.localeCompare(b.first_seen)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [issues, filter, asOf, alerts.length],
  )
  useEffect(() => setPage(0), [filter, id])

  if (!project) return <p>Unknown project.</p>
  const st = statusOn(bundle, project.id, asOf)
  const snap = latestSnapshot(bundle, project.id, asOf)

  const view = params.get("view") === "lessons" ? "lessons" : "issues"
  const setView = (v: "issues" | "lessons") => {
    const next = new URLSearchParams(params)
    if (v === "lessons") next.set("view", "lessons"); else next.delete("view")
    setParams(next)
  }
  const wanted = params.get("issue")
  const selected = sorted.find((i) => i.id === wanted) ?? issues.find((i) => i.id === wanted) ?? sorted[0] ?? null
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE))
  const rows = sorted.slice(page * PAGE, page * PAGE + PAGE)
  const label = (cp: string | null) => (cp ? bundle.counterparties[cp]?.label ?? cp : "No counterparty")

  return (
    <div className="flex h-full flex-col gap-3">
      <Panel className="flex shrink-0 items-center gap-6 px-4 py-2.5">
        <div className="min-w-0">
          <h1 className="font-heading text-[18px] font-semibold leading-tight">{project.name}</h1>
          <p className="text-[12px] text-muted-ink">{[phaseOn(project, asOf), project.pm && `PM ${project.pm}`].filter(Boolean).join(" · ")}</p>
        </div>
        {docs.length > 0 && (
          <div className="flex gap-3">
            <div><div className="text-[12px] text-muted-ink">Reported</div><ReportedPill status={st?.reported_status} /></div>
            <div><div className="text-[12px] text-muted-ink">Evidence</div><EvidencePill status={st?.evidence_status} /></div>
          </div>
        )}
        <div role="tablist" className="flex shrink-0 gap-1">
          {([["issues", "Issues"], ["lessons", "Lessons"]] as const).map(([v, label]) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}
              className={cn("rounded-md px-3 py-1.5 text-[13px]", view === v ? "bg-navy-900 font-medium text-white" : "text-muted-ink hover:bg-bg")}>
              {label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-5 whitespace-nowrap text-[13px]">
          <div><div className="text-[12px] text-muted-ink">Baseline energisation</div><div className="num font-medium">{fmtDate(project.baseline_energisation)}</div></div>
          <div><div className="text-[12px] text-muted-ink">Latest forecast</div><div className="num font-medium">{snap?.forecast ? fmtDate(snap.forecast) : "—"}</div></div>
          <div className="max-w-[240px]">
            <div className="text-[12px] text-muted-ink">Commercial</div>
            <div className="num truncate font-medium">{project.commercial_date ? `${fmtDate(project.commercial_date)} (${daysBetween(asOf, project.commercial_date)} days)` : project.commercial_label}</div>
          </div>
        </div>
      </Panel>

      {docs.length === 0 ? (
        <Panel className="p-6 text-[14px] text-muted-ink">No documents for this project as of {fmtDate(asOf)}.</Panel>
      ) : view === "lessons" ? (
        <LessonsView project={project.id} />
      ) : (
        <div className="flex min-h-0 flex-1 gap-3">
          <Panel className="flex w-[38%] shrink-0 flex-col">
            <div className="flex h-10 shrink-0 items-center gap-1 px-3">
              {(["open", "all"] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f}
                  className={cn("rounded-md px-2.5 py-1 text-[13px]", filter === f ? "bg-navy-900 font-medium text-white" : "text-muted-ink hover:bg-bg")}>
                  {f === "open" ? "Open" : "All"}
                </button>
              ))}
            </div>
            <ul className="min-h-0 flex-1 px-2">
              {rows.map((i) => {
                const sev = topSev(i)
                const status = issueStatusOn(i, asOf)
                return (
                  <li key={i.id}>
                    <button
                      onClick={() => setParams({ issue: i.id })}
                      aria-current={selected?.id === i.id}
                      className={cn("flex h-[46px] w-full items-center gap-2 rounded-md px-2 text-left hover:bg-bg", selected?.id === i.id && "bg-accent")}
                    >
                      {sev ? <SeverityIcon severity={sev === 3 ? "red" : sev === 2 ? "amber" : "info"} /> : <span className="w-4 shrink-0" />}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">{i.title}</span>
                        <span className="block truncate text-[12px] text-muted-ink">
                          {isOpenStatus(status) ? ageText(i.first_seen, asOf) : STATUS_WORDS[status ?? "open"]} · {label(i.counterparty)}
                        </span>
                      </span>
                      <span className="num shrink-0 text-[12px] text-muted-ink" title="Mentions">{mentionsUpTo(i, asOf).length}×</span>
                    </button>
                  </li>
                )
              })}
              {rows.length === 0 && <li className="px-2 py-3 text-[13px] text-muted-ink">No issues to show.</li>}
            </ul>
            <Pager page={page} pages={pages} onPage={setPage} total={sorted.length} label={sorted.length === 1 ? "issue" : "issues"} />
          </Panel>

          <Panel className="min-w-0 flex-1 overflow-hidden">
            {selected ? <IssueDetail issue={selected} tab={tab} setTab={setTab} /> : <p className="p-4 text-[13px] text-muted-ink">No issue selected.</p>}
          </Panel>
        </div>
      )}
    </div>
  )
}

function IssueDetail({ issue, tab, setTab }: { issue: Issue; tab: Tab; setTab: (t: Tab) => void }) {
  const bundle = useStore((s) => s.bundle)!
  const asOf = useStore((s) => s.asOf)
  const openDrawer = useStore((s) => s.openDrawer)
  const status = issueStatusOn(issue, asOf)
  const ms = mentionsUpTo(issue, asOf)
  const alerts = bundle.alerts.filter((a) => a.issue_id === issue.id && a.fired_on <= asOf).sort((a, b) => a.fired_on.localeCompare(b.fired_on))
  const triggers = triggersFor(bundle, issue.id, asOf)
  const matches = matchesFor(bundle, issue, asOf)
  const docs = bundle.documents
  const docOf = (id: string) => docs.find((d) => d.id === id)!
  const cp = issue.counterparty ? bundle.counterparties[issue.counterparty]?.label ?? issue.counterparty : "None"
  const [evPage, setEvPage] = useState(0)
  useEffect(() => setEvPage(0), [issue.id])
  const evRows = [...ms].reverse()
  const EV = 4

  const tabs: { id: Tab; label: string; n: number }[] = [
    { id: "evidence", label: "Evidence", n: ms.length },
    { id: "alerts", label: "Alerts", n: alerts.length },
    { id: "seen", label: "Seen before", n: matches.length },
    { id: "triggers", label: "Triggers", n: triggers.length },
  ]

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-4 pt-3">
        <h2 className="text-[15px] font-semibold leading-snug">{issue.title}</h2>
        <p className="text-[12px] text-muted-ink">
          {categoryLabel(issue.category)} · {cp} · {STATUS_WORDS[status ?? "open"]} · first seen {fmtDate(issue.first_seen)} · {isOpenStatus(status) ? ageText(issue.first_seen, asOf) : "closed"}
        </p>
      </div>
      <div className="px-4 pt-1">
        <IssueTimeline issue={issue} asOf={asOf} alerts={alerts} triggers={triggers} docs={docs} />
      </div>
      <div role="tablist" className="flex shrink-0 gap-1 border-b border-line px-3">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={cn("-mb-px border-b-2 px-3 py-1.5 text-[13px]", tab === t.id ? "border-blue-500 font-medium text-ink" : "border-transparent text-muted-ink hover:text-ink")}>
            {t.label} <span className="num text-[12px] text-muted-ink">{t.n}</span>
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden px-4 py-2 text-[13px]">
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
                      {(m.evidence_quote || m.description) && <span className="line-clamp-1 text-[12px] text-muted-ink">{m.evidence_quote ? `“${m.evidence_quote.replace(/\*\*/g, "")}”` : m.description}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {evRows.length > EV && <Pager page={evPage} pages={Math.ceil(evRows.length / EV)} onPage={setEvPage} total={evRows.length} label="mentions" />}
          </>
        )}
        {tab === "alerts" && (
          alerts.length === 0 ? <p className="text-muted-ink">No alerts have fired for this issue as of {fmtDate(asOf)}.</p> : (
            <ul className="space-y-1.5">
              {[...alerts].sort(bySeverityThenNewest).slice(0, 4).map((a) => (
                <li key={a.id} className="flex items-start gap-2">
                  <SeverityPill severity={a.severity} />
                  <span className="min-w-0">
                    <span className="font-medium">{ruleWords(a.rule, a.severity)}</span>
                    <span className="num text-muted-ink"> · {fmtDate(a.fired_on)}</span>
                    <span className="line-clamp-2 text-[12px] text-muted-ink">{a.explanation}</span>
                  </span>
                </li>
              ))}
            </ul>
          )
        )}
        {tab === "seen" && <SeenBefore issue={issue} />}
        {tab === "triggers" && (
          triggers.length === 0 ? <p className="text-muted-ink">No staged triggers declared in the reports so far.</p> : (
            <ul className="space-y-1.5">
              {triggers.slice(0, 3).map((t) => {
                const left = t.deadline ? daysBetween(asOf, t.deadline) : null
                return (
                  <li key={t.id}>
                    <span className="line-clamp-1">“{t.condition_text}”</span>
                    <span className="num text-[12px] text-muted-ink">
                      Declared {fmtDate(t.declared_on)} · {t.deadline ? `deadline ${fmtDate(t.deadline)}, ${left! >= 0 ? `${left} days remaining` : `passed ${-left!} days ago`}` : "no date could be set"}
                    </span>
                  </li>
                )
              })}
            </ul>
          )
        )}
      </div>
    </div>
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
                <span className="line-clamp-1 flex-1 text-[12px] text-muted-ink">{m.explanation}</span>
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
