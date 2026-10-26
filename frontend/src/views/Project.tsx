import { useMemo } from "react"
import { Eye } from "lucide-react"
import { useParams, useSearchParams } from "react-router-dom"
import { useStore } from "@/store"
import { daysBetween, fmtDate } from "@/lib/format"
import { docsUpTo, latestSnapshot, phaseOn, statusOn } from "@/lib/selectors"
import { EvidencePill, Panel, ReportedPill, SeverityIcon } from "@/components/ui-bits"
import { LessonsView } from "@/views/Lessons"
import { ActionDetail } from "@/components/ActionDetail"
import { buildActions, TIER_WORDS, type ActionItem, type Tier } from "@/lib/actions"
import { watchOn } from "@/lib/watch"
import { cn } from "@/lib/utils"

const TIERS: Tier[] = ["now", "prepare", "watch", "past"]

export function Project() {
  const { id } = useParams()
  const bundle = useStore((s) => s.bundle)!
  const asOf = useStore((s) => s.asOf)
  const actions = useStore((s) => s.actions)
  const [params, setParams] = useSearchParams()

  const project = bundle.projects.find((p) => p.id === id)
  const docs = docsUpTo(bundle, asOf, id)
  const watch = watchOn(bundle, asOf, id)
  const items = useMemo(() => buildActions(bundle, asOf).filter((i) => i.project === id), [bundle, asOf, id])

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
  const selected = items.find((i) => i.issue.id === wanted || i.also.some((a) => a.id === wanted)) ?? items.find((i) => i.tier === "now" || i.tier === "prepare") ?? items[0] ?? null
  const byTier = (t: Tier) => items.filter((i) => i.tier === t)
  const decide = byTier("now").length + byTier("prepare").length
  const hasDecisions = decide > 0

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
          <div className="max-w-[260px] whitespace-normal">
            <div className="text-[12px] text-muted-ink">Commercial</div>
            <div className="num font-medium">{project.commercial_date ? `${fmtDate(project.commercial_date)} (${daysBetween(asOf, project.commercial_date)} days)` : project.commercial_label}</div>
          </div>
        </div>
      </Panel>

      {watch.length > 0 && view === "issues" && (
        <Panel className="shrink-0 border-blue-500/40 px-4 py-2.5" aria-label="Watch notes">
          <h2 className="flex items-center gap-1.5 text-[13px] font-semibold"><Eye size={15} className="text-blue-600" aria-hidden />Watch: not raised on this project yet</h2>
          <ul className="mt-1 space-y-1.5">
            {watch.map((w) => (
              <li key={w.note.id} className="text-[13px]">
                <span className="font-medium">{w.title}.</span>{" "}
                <span className="text-muted-ink">{w.history.map((h) => h.text).join("; ")}.</span>{" "}
                <span>{w.advice}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {docs.length === 0 ? (
        <Panel className="p-6 text-[14px] text-muted-ink">No documents for this project as of {fmtDate(asOf)}.</Panel>
      ) : view === "lessons" ? (
        <LessonsView project={project.id} />
      ) : (
        <div className="flex min-h-0 flex-1 gap-3">
          <Panel className="flex w-[38%] shrink-0 flex-col overflow-y-auto px-2 py-2">
            <p className="px-2 pb-1 text-[12px] text-muted-ink">{decide ? `${decide} to decide` : "Nothing to decide"} · {items.length} {items.length === 1 ? "issue" : "issues"} in all</p>
            {TIERS.map((t) => {
              const list = byTier(t)
              if (!list.length) return null
              const open = t === "now" || t === "prepare" || selected?.tier === t || !hasDecisions
              return (
                <details key={t + (open ? "o" : "c")} open={open} className="mb-1">
                  <summary className="flex cursor-pointer list-none items-center gap-1.5 px-2 py-1 text-[12px] font-semibold text-muted-ink">
                    {TIER_WORDS[t]} <span className="num font-normal">{list.length}</span>
                  </summary>
                  <ul>
                    {list.map((i) => <Row key={i.issue.id} item={i} selected={selected?.issue.id === i.issue.id} handled={!!actions[i.issue.id]} onPick={() => setParams({ issue: i.issue.id })} />)}
                  </ul>
                </details>
              )
            })}
            {items.length === 0 && <p className="px-2 py-3 text-[13px] text-muted-ink">No issues yet.</p>}
          </Panel>

          <Panel className="min-w-0 flex-1 overflow-hidden">
            {selected ? <ActionDetail item={selected} /> : <p className="p-4 text-[13px] text-muted-ink">No issue selected.</p>}
          </Panel>
        </div>
      )}
    </div>
  )
}

function Row({ item, selected, handled, onPick }: { item: ActionItem; selected: boolean; handled: boolean; onPick: () => void }) {
  const asOf = useStore((s) => s.asOf)
  const when = item.tier === "past" ? "past incident"
    : item.daysLeft !== null ? `report says by ${fmtDate(item.decideBy!)} (${item.daysLeft === 0 ? "due today" : `${item.daysLeft} days`})`
    : item.affecting ? "already affecting programme" : item.tier === "prepare" ? "no date in the report" : `open ${daysBetween(item.issue.first_seen, asOf)} days`
  return (
    <li>
      <button onClick={onPick} aria-current={selected}
        className={cn("flex min-h-[46px] w-full items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-bg", selected && "bg-accent")}>
        <span className="w-4 shrink-0">{item.severity !== "info" && <SeverityIcon severity={item.severity} />}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium leading-snug">{item.issue.title}</span>
          <span className="block text-[12px] text-muted-ink">{when}{item.also.length ? ` · +${item.also.length} related` : ""}{handled ? " · handled" : ""}</span>
        </span>
      </button>
    </li>
  )
}
