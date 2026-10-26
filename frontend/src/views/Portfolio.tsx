import { AlertOctagon, AlertTriangle, CheckCircle2, MinusCircle } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { useStore } from "@/store"
import { fmtDate } from "@/lib/format"
import { watchOn } from "@/lib/watch"
import { buildActions, decisionFor, TIER_WORDS } from "@/lib/actions"
import { changesSince, docsUpTo, headlineFor, latestSnapshot, statusOn } from "@/lib/selectors"
import { ActionDetail } from "@/components/ActionDetail"
import { EvidencePill, Pager, Panel, PROJECT_COLOUR, ReportedPill, SeverityIcon } from "@/components/ui-bits"
import { cn } from "@/lib/utils"
import type { Project } from "@/types"

const PAGE = 6

export function Portfolio() {
  const bundle = useStore((s) => s.bundle)!
  const asOf = useStore((s) => s.asOf)
  const actions = useStore((s) => s.actions)
  const all = useMemo(() => buildActions(bundle, asOf).filter((i) => i.tier === "now" || i.tier === "prepare"), [bundle, asOf])
  const [tab, setTab] = useState<"todo" | "done">("todo")
  const [params] = useSearchParams()
  const [sel, setSel] = useState<string | null>(params.get("item"))   // deep link: #/?item=ISSUE_ID
  const [page, setPage] = useState(0)

  const dec = (i: (typeof all)[number]) => decisionFor(bundle, i, actions[i.issue.id], asOf)
  const navigate = useNavigate()
  const news = useMemo(() => changesSince(bundle, asOf), [bundle, asOf])
  const newIds = new Set(news.items.map((n) => n.issueId))
  const isNew = (i: (typeof all)[number]) => newIds.has(i.issue.id) || i.also.some((a) => newIds.has(a.id))
  const openNew = (issueId: string, project: string) => {
    const hit = all.find((i) => i.issue.id === issueId || i.also.some((a) => a.id === issueId))
    if (hit) { setTab("todo"); setSel(hit.issue.id) } else navigate(`/project/${project}?issue=${issueId}`)
  }
  const todo = all.filter((i) => !dec(i).handled)
  const done = all.filter((i) => dec(i).handled)
  const list = tab === "todo" ? todo : done
  const pages = Math.max(1, Math.ceil(list.length / PAGE))
  useEffect(() => setPage(0), [tab, asOf])
  const selected = list.find((i) => i.issue.id === sel) ?? list[0]
  const rows = list.slice(page * PAGE, page * PAGE + PAGE)

  return (
    <div className="flex flex-col gap-3">
      <h1 className="sr-only">Portfolio</h1>
      <div className="grid shrink-0 grid-cols-3 gap-3">
        {bundle.projects.map((p) => <ProjectTile key={p.id} p={p} todo={todo.filter((i) => i.project === p.id).length} />)}
      </div>

      {news.items.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px]" aria-label="New since the previous report">
          <span className="font-semibold">{news.from ? `New since ${fmtDate(news.from)}` : "New"}</span>
          {news.items.slice(0, 4).map((n) => (
            <button key={n.issueId + n.text} onClick={() => openNew(n.issueId, n.project)} className="text-left hover:underline">
              <span className="capitalize text-muted-ink">{n.project}</span> · {n.text}
            </button>
          ))}
          {news.items.length > 4 && <span className="text-muted-ink">and {news.items.length - 4} more</span>}
        </div>
      )}

      <div className="flex items-start gap-3">
        <Panel className="sticky top-0 flex w-[38%] shrink-0 flex-col">
          <div className="flex h-11 shrink-0 items-center gap-1 px-3">
            <h2 className="mr-auto text-[14px] font-semibold">Needs a decision</h2>
            {([["todo", `To do ${todo.length}`], ["done", `Handled ${done.length}`]] as const).map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k}
                className={cn("rounded-md px-2.5 py-1 text-[13px]", tab === k ? "bg-navy-900 font-medium text-white" : "text-muted-ink hover:bg-bg")}>{label}</button>
            ))}
          </div>
          <ul className="min-h-0 flex-1 px-2">
            {rows.map((i, n) => (
              <li key={i.issue.id}>
                {(n === 0 || rows[n - 1].tier !== i.tier) && <h3 className="px-2 pb-0.5 pt-1 text-[12px] font-semibold text-muted-ink">{TIER_WORDS[i.tier]}</h3>}
                <button onClick={() => setSel(i.issue.id)} aria-current={selected?.issue.id === i.issue.id}
                  className={cn("flex min-h-[54px] w-full items-center gap-2.5 rounded-md px-2 text-left hover:bg-bg", selected?.issue.id === i.issue.id && "bg-accent")}>
                  <SeverityIcon severity={i.severity} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{i.issue.title}{isNew(i) && <span className="ml-1.5 rounded-sm bg-blue-500/15 px-1.5 py-px text-[11px] font-medium text-[#0B6DA6]">New</span>}</span>
                    <span className="block text-[12px] text-muted-ink">
                      <span className="capitalize">{i.project}</span>
                      {" · "}
                      {i.daysLeft !== null ? `report says by ${fmtDate(i.decideBy!)} (${i.daysLeft === 0 ? "due today" : `${i.daysLeft} days`})` : i.alerts.some((a) => a.rule === "IMPACT") ? "already affecting programme" : "no date in the report"}{dec(i).reopened ? " · back: new information" : ""}
                    </span>
                  </span>
                  <span className="size-2 shrink-0 rounded-full" style={{ background: PROJECT_COLOUR[i.project] }} aria-hidden />
                </button>
              </li>
            ))}
            {rows.length === 0 && (
              <li className="px-3 py-4 text-[13px] text-muted-ink">
                {tab === "todo" ? `Nothing needs a decision as of ${fmtDate(asOf)}.` : "No actions handled yet."}
              </li>
            )}
          </ul>
          <Pager page={page} pages={pages} onPage={setPage} total={list.length} label={list.length === 1 ? "item" : "items"} />
        </Panel>

        <Panel className="min-w-0 flex-1">
          {selected ? <ActionDetail item={selected} /> : (
            <div className="p-6 text-[14px] text-muted-ink">
              {tab === "todo" ? "No open decisions. Move the date forward to see how the picture changes." : "Handled items appear here."}
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}

const TONE_ICON = {
  red: <AlertOctagon size={16} className="shrink-0 text-red" aria-hidden />,
  amber: <AlertTriangle size={16} className="shrink-0 text-amber" aria-hidden />,
  green: <CheckCircle2 size={16} className="shrink-0 text-green" aria-hidden />,
  grey: <MinusCircle size={16} className="shrink-0 text-navy-600" aria-hidden />,
}

function ProjectTile({ p, todo }: { p: Project; todo: number }) {
  const bundle = useStore((s) => s.bundle)!
  const asOf = useStore((s) => s.asOf)
  const docs = docsUpTo(bundle, asOf, p.id)
  const st = statusOn(bundle, p.id, asOf)
  const head = headlineFor(bundle, p.id, asOf)
  const snap = latestSnapshot(bundle, p.id, asOf)
  const watching = watchOn(bundle, asOf, p.id).length

  return (
    <Link to={`/project/${p.id}`} className={cn("block rounded-lg border bg-surface px-3 py-1.5 hover:bg-bg", st?.divergent ? "border-red" : "border-line")}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span className="size-2.5 rounded-full" style={{ background: PROJECT_COLOUR[p.id] }} aria-hidden />
          <span className="font-heading text-[14px] font-semibold">{p.name}</span>
        </span>
        <span className="text-[12px] text-muted-ink">{docs.length ? `${todo} to decide${watching ? ` · ${watching} on watch` : ""}${snap?.float_days != null ? ` · float ${snap.float_days} d` : ""}` : `No documents yet${watching ? ` · ${watching} on watch` : ""}`}</span>
      </div>
      {docs.length > 0 && (
        <>
          <div className="mt-1 flex items-center gap-2">
            <ReportedPill status={st?.reported_status} />
            <EvidencePill status={st?.evidence_status} />
          </div>
          <p className={cn("mt-1 flex items-center gap-1.5 truncate text-[12px]", st?.divergent ? "font-medium text-red" : "text-muted-ink")}>
            {TONE_ICON[head.tone]}<span className="truncate">{st?.divergent ? "Reported and evidence disagree" : head.text}</span>
          </p>
        </>
      )}
    </Link>
  )
}
