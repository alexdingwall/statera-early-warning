import { AlertOctagon, AlertTriangle, CheckCircle2, ChevronRight, MinusCircle } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { useStore } from "@/store"
import { fmtDate } from "@/lib/format"
import { buildActions, decisionFor, TIER_WORDS, type ActionItem } from "@/lib/actions"
import { watchOn } from "@/lib/watch"
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
  const every = useMemo(() => buildActions(bundle, asOf), [bundle, asOf])
  const all = useMemo(() => every.filter((i) => i.tier === "now" || i.tier === "prepare"), [every])
  /** Open issues with no warning yet, but a deadline already set by the report, or a similar problem on another project. */
  const radar = useMemo(() => every.filter((i) => i.tier === "watch" && ((i.daysLeft !== null && i.daysLeft >= 0) || i.lastTime?.kind === "incident")), [every])
  const watching = useMemo(() => watchOn(bundle, asOf), [bundle, asOf])
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
  /** One button per project saying what kind of "new" it is, folded the way the queue folds related issues. */
  const summary = useMemo(() => {
    const itemOf = (id: string) => every.find((i) => i.issue.id === id || i.also.some((a) => a.id === id))
    type G = { project: string; firstId: string | null; decide: Set<string>; watch: Set<string>; past: Set<string>; warnings: Set<string>; resolved: Set<string> }
    const by = new Map<string, G>()
    for (const n of news.items) {
      const g = by.get(n.project) ?? { project: n.project, firstId: null, decide: new Set(), watch: new Set(), past: new Set(), warnings: new Set(), resolved: new Set() }
      by.set(n.project, g)
      const it = itemOf(n.issueId)
      const id = it?.issue.id ?? n.issueId
      const actionable = it?.tier === "now" || it?.tier === "prepare"
      if (n.kind === "warning") g.warnings.add(id)
      else if (n.kind === "resolved") g.resolved.add(id)
      else if (actionable) g.decide.add(id)
      else if (it?.tier === "past") g.past.add(id)
      else g.watch.add(id)
      if (actionable && (g.firstId === null || !every.find((i) => i.issue.id === g.firstId && (i.tier === "now" || i.tier === "prepare")))) g.firstId = id
      else if (g.firstId === null) g.firstId = id
    }
    const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`
    return [...by.values()].map((g) => ({
      project: g.project, firstId: g.firstId ?? "", actionable: g.decide.size > 0 || g.warnings.size > 0,
      parts: [
        g.warnings.size && plural(g.warnings.size, "new warning"),
        g.decide.size && `${plural(g.decide.size, "new issue")} to decide`,
        g.watch.size && `${plural(g.watch.size, "new issue")} to watch`,
        // past incidents only matter on their own: next to something to act on they are noise
        g.past.size && !(g.decide.size || g.warnings.size || g.watch.size) && `${plural(g.past.size, "past incident")} recorded, nothing to decide`,
        g.resolved.size && `${g.resolved.size} resolved`,
      ].filter(Boolean) as string[],
    })).filter((g) => g.parts.length)
  }, [news, every])
  const todo = all.filter((i) => !dec(i).handled)
  const done = all.filter((i) => dec(i).handled)
  const list = tab === "todo" ? todo : done
  const pages = Math.max(1, Math.ceil(list.length / PAGE))
  useEffect(() => setPage(0), [tab, asOf])
  const pool = tab === "todo" ? [...list, ...radar] : list
  // Open on the item that came back with new information, else the most urgent
  const selected = pool.find((i) => i.issue.id === sel) ?? list.find((i) => dec(i).reopened) ?? list[0] ?? pool[0]
  const rows = list.slice(page * PAGE, page * PAGE + PAGE)

  return (
    <div className="flex flex-col gap-3">
      <h1 className="sr-only">Portfolio</h1>
      <div className="grid shrink-0 grid-cols-3 gap-3">
        {bundle.projects.map((p) => <ProjectTile key={p.id} p={p} todo={todo.filter((i) => i.project === p.id).length} />)}
      </div>

      {watching.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-baseline gap-x-4 gap-y-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px]" aria-label="On watch">
          <span className="font-semibold">On watch</span>
          {[...new Set(watching.map((w) => w.note.project))].map((proj) => (
            <Link key={proj} to={`/project/${proj}`} className="hover:underline">
              <span className="capitalize">{proj}</span>
              <span className="text-muted-ink">: {watching.filter((w) => w.note.project === proj).map((w) => w.title).join("; ")}</span>
            </Link>
          ))}
        </div>
      )}

      {summary.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[13px]" aria-label="New since the previous report">
          <span className="mr-1 font-semibold">{news.from ? `New since ${fmtDate(news.from)}` : "New"}</span>
          {summary.map((g) => (
            <button key={g.project} onClick={() => openNew(g.firstId, g.project)}
              className={cn("flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-left font-medium hover:bg-bg",
                g.actionable ? "border-blue-500/50 bg-blue-500/5 text-ink" : "border-line text-ink")}>
              <span className="capitalize">{g.project}</span>
              <span className="font-normal text-muted-ink">{g.parts.join(" · ")}</span>
              <span className={cn("ml-1 text-[12px] font-semibold", g.actionable ? "text-[#0B6DA6]" : "text-muted-ink")}>{g.actionable ? "Review" : "View"}</span>
              <ChevronRight size={14} className={g.actionable ? "text-[#0B6DA6]" : "text-muted-ink"} aria-hidden />
            </button>
          ))}
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
                <QueueRow item={i} selected={selected?.issue.id === i.issue.id} isNew={isNew(i)} reopened={!!dec(i).reopened} onPick={() => setSel(i.issue.id)} />
              </li>
            ))}
            {tab === "todo" && radar.length > 0 && (
              <>
                <li><h3 className="px-2 pb-0.5 pt-2 text-[12px] font-semibold text-muted-ink">On the radar: a deadline is set, or it has happened before</h3></li>
                {radar.map((i) => (
                  <li key={i.issue.id}><QueueRow item={i} selected={selected?.issue.id === i.issue.id} isNew={isNew(i)} reopened={false} onPick={() => setSel(i.issue.id)} /></li>
                ))}
              </>
            )}
            {rows.length === 0 && radar.length === 0 && (
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

function QueueRow({ item: i, selected, isNew, reopened, onPick }: { item: ActionItem; selected: boolean; isNew: boolean; reopened: boolean; onPick: () => void }) {
  return (
    <button onClick={onPick} aria-current={selected}
      className={cn("flex min-h-[54px] w-full items-center gap-2.5 rounded-md px-2 text-left hover:bg-bg", selected && "bg-accent")}>
      <span className="w-4 shrink-0">{i.severity !== "info" && <SeverityIcon severity={i.severity} />}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium">{i.issue.title}{isNew && <span className="ml-1.5 rounded-sm bg-blue-500/15 px-1.5 py-px text-[11px] font-medium text-[#0B6DA6]">New</span>}</span>
        <span className="block text-[12px] text-muted-ink">
          <span className="capitalize">{i.project}</span>
          {" · "}
          {i.daysLeft !== null ? `report says by ${fmtDate(i.decideBy!)} (${i.daysLeft === 0 ? "due today" : `${i.daysLeft} days`})`
            : i.alerts.some((a) => a.rule === "IMPACT") ? "already affecting programme"
            : i.tier === "watch" && i.lastTime?.prior ? `a similar problem happened at ${i.lastTime.prior.project.charAt(0).toUpperCase()}${i.lastTime.prior.project.slice(1)} before (${i.lastTime.confidence ?? "medium"} match)`
            : "no date in the report"}{reopened ? " · back: new information" : ""}
        </span>
      </span>
    </button>
  )
}
