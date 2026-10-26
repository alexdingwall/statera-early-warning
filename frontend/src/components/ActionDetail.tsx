import { BellOff, Check, History, Megaphone, RotateCcw } from "lucide-react"
import { Link } from "react-router-dom"
import { useStore } from "@/store"
import { ageText, categoryLabel, fmtDate, STATUS_WORDS } from "@/lib/format"
import { decisionFor, STATE_WORDS, type ActionItem, type ActionState } from "@/lib/actions"
import { SeverityIcon, btn, btnPrimary } from "@/components/ui-bits"
import { IssueTabs } from "@/components/IssueTabs"
import { readFb, writeFb } from "@/lib/feedback"
import { useState } from "react"
import { cn } from "@/lib/utils"

export function ActionButtons({ item, compact }: { item: ActionItem; compact?: boolean }) {
  const bundle = useStore((s) => s.bundle)!
  const saved = useStore((s) => s.actions[item.issue.id])
  const asOf = useStore((s) => s.asOf)
  const dec = decisionFor(bundle, item, saved, asOf)
  const rec = dec.handled ? dec.rec : null
  const setAction = useStore((s) => s.setAction)
  const set = (state: ActionState) => setAction(item.issue.id, { state, on: asOf })
  if (rec) {
    return (
      <div className="flex items-center gap-2 text-[13px]">
        <span className="flex items-center gap-1 font-medium text-green"><Check size={15} aria-hidden />{STATE_WORDS[rec.state]} on {fmtDate(rec.on)}</span>
        <button className="text-[#0B6DA6] hover:underline" onClick={() => setAction(item.issue.id, null)}>Reopen</button>
      </div>
    )
  }
  const size = compact ? "h-7 text-[12px]" : ""
  return (
    <div>
    {dec.reopened && <p className="mb-1.5 flex items-start gap-1.5 text-[13px] font-medium text-[#8A5A12]"><RotateCcw size={14} className="mt-[3px] shrink-0" aria-hidden />{dec.reopened}</p>}
    <div className="flex gap-2">
      <button title="Records your decision on this device only. Nothing is sent." className={`${btnPrimary} ${size}`} onClick={() => set("escalated")}><Megaphone size={14} aria-hidden />Mark as escalated</button>
      <button className={`${btn} ${size}`} onClick={() => set("acknowledged")}><Check size={14} aria-hidden />Acknowledge</button>
      <button className={`${btn} ${size}`} onClick={() => set("snoozed")}><BellOff size={14} aria-hidden />Snooze</button>
    </div>
    {!compact && <p className="mt-1 text-[12px] text-muted-ink">Saved on this device only. Nothing is sent to anyone.</p>}
    </div>
  )
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1 text-[12px] font-semibold text-muted-ink">{title}</h3>
      {children}
    </section>
  )
}

export function ActionDetail({ item }: { item: ActionItem }) {
  const asOf = useStore((s) => s.asOf)
  const openDrawer = useStore((s) => s.openDrawer)
  const { issue } = item
  const latest = issue.mentions.filter((m) => m.date <= asOf).slice(-1)[0]

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5 overflow-y-auto p-3.5">
      <div className="flex items-start gap-2">
        <span className="mt-0.5"><SeverityIcon severity={item.severity} size={18} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-semibold leading-snug">{issue.title}</h2>
          <p className="text-[12px] text-muted-ink">
            <span className="capitalize">{item.project}</span> · {categoryLabel(issue.category)} · {ageText(issue.first_seen, asOf)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5 text-[12px]">
          {latest && <button className="text-[#0B6DA6] hover:underline" onClick={() => openDrawer({ docId: latest.doc_id, span: latest.quote_span })}>Latest source document</button>}
        </div>
      </div>

      <div className="shrink-0 rounded-md border border-blue-500/40 bg-blue-500/5 p-3">
        <h3 className="mb-1 text-[12px] font-semibold text-[#0B6DA6]">{item.tier === "watch" ? "Status" : item.tier === "past" ? "Closed" : "Recommended action"}</h3>
        <p className="text-[15px] font-semibold leading-snug">{item.action}</p>
        {(item.tier === "now" || item.tier === "prepare") && <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <ActionButtons item={item} />
          <p className="text-[12px] text-muted-ink">
            {item.owner ? `Suggested owner: ${item.owner}` : ""}{item.decideBy ? ` · date stated in report: ${fmtDate(item.decideBy)}` : ""}
          </p>
        </div>}
      </div>

      <div className={`grid shrink-0 ${item.stakes.length ? "grid-cols-[3fr_2fr]" : "grid-cols-1"} gap-5 text-[13px]`}>
        <Block title="Why now">
          <ul className="list-disc space-y-0.5 pl-4">
            {item.why.slice(0, 3).map((w) => <li key={w}>{w}</li>)}
          </ul>
        </Block>
        {(item.stakes.length > 0 || item.tier === "now" || item.tier === "prepare") && <Block title="What is at stake">
          {item.stakes.length ? (
            <ul className="list-disc space-y-0.5 pl-4">{item.stakes.map((w) => <li key={w}>{w}</li>)}</ul>
          ) : <p className="text-muted-ink">No programme figures reported yet.</p>}
        </Block>}
      </div>

      {item.lastTime && (
        <div className="shrink-0 rounded-md bg-bg px-3 py-2 text-[13px]">
          <div className="mb-0.5 flex items-center justify-between">
            <h3 className="flex items-center gap-1 text-[12px] font-semibold text-muted-ink"><History size={13} aria-hidden />{item.lastTime.kind === "incident" ? "Last time" : "Lesson from Netherwood"}</h3>
            {item.lastTime.prior && (
              <Link to={`/project/${item.lastTime.prior.project}?issue=${item.lastTime.prior.id}`} className="text-[12px] text-[#0B6DA6] hover:underline">
                Open the earlier issue at <span className="capitalize">{item.lastTime.prior.project}</span>
              </Link>
            )}
          </div>
          <p>{item.lastTime.text}</p>
          {item.lastTime.prior && (
            <ul className="mt-1 space-y-0.5 text-[12px]">
              {item.lastTime.prior.events.map((e) => (
                <li key={e.docId + e.date}>
                  <span className="num text-muted-ink">{fmtDate(e.date)} · </span>
                  <button className="text-[#0B6DA6] hover:underline" onClick={() => openDrawer({ docId: e.docId, span: e.span })}>{e.docTitle}</button>
                  <span className="text-muted-ink"> · {STATUS_WORDS[e.status] ?? e.status}</span>
                </li>
              ))}
            </ul>
          )}
          {item.lastTime.lesson && <p className="mt-1 font-medium text-[#8A5A12]">{item.lastTime.lesson}</p>}
          {item.lastTime.matchId && <Relevance id={item.lastTime.matchId} />}
        </div>
      )}

      <IssueTabs issue={issue} />
    </div>
  )
}

function Relevance({ id }: { id: string }) {
  const [v, setV] = useState<string | null>(() => readFb(id))
  return (
    <div className="mt-1.5 flex items-center gap-2 text-[12px]">
      <span className="text-muted-ink">Is this a fair comparison?</span>
      {(["relevant", "not relevant"] as const).map((k) => (
        <button key={k} aria-pressed={v === k} onClick={() => { writeFb(id, k); setV(k) }}
          className={cn("rounded-md border px-2 py-0.5", v === k ? "border-navy-900 bg-navy-900 text-white" : "border-line bg-surface hover:bg-bg")}>
          {k === "relevant" ? "Yes" : "No"}
        </button>
      ))}
      <span className="text-muted-ink">Saved here only. A full version would learn from it.</span>
    </div>
  )
}
