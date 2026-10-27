import { BellOff, Check, ChevronRight, Megaphone, RotateCcw } from "lucide-react"
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
  const showToast = useStore((s) => s.showToast)
  const set = (state: ActionState) => {
    setAction(item.issue.id, { state, on: asOf })
    showToast({
      text: `${STATE_WORDS[state]}: ${item.issue.title}. It has moved to Handled and comes back if something new arrives.`,
      undo: () => { setAction(item.issue.id, null); showToast(null) },
    })
  }
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
    <div className="flex flex-col gap-2.5 p-3.5">
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
        {(item.tier === "now" || item.tier === "prepare") && <div className="mt-2 flex flex-col gap-1.5">
          <ActionButtons item={item} />
          <p className="text-[12px] text-muted-ink">
            {[item.owner && `Suggested owner: ${item.owner}`, item.decideBy && `date stated in report: ${fmtDate(item.decideBy)}`, "Saved on this device only"].filter(Boolean).join(" · ")}
          </p>
        </div>}
      </div>

      <div className={`grid shrink-0 ${item.stakes.length >= 2 ? "grid-cols-[3fr_2fr]" : "grid-cols-1"} gap-5 text-[13px]`}>
        <Block title="Why now">
          <ul className="list-disc space-y-0.5 pl-4">
            {item.why.slice(0, 3).map((w) => <li key={w}>{w}</li>)}
          </ul>
          {item.stakes.length === 1 && <p className="mt-1.5"><span className="font-semibold text-muted-ink">At stake: </span>{item.stakes[0]}</p>}
          {item.also.length > 0 && <p className="mt-1.5 text-muted-ink">Same report also raised: {item.also.map((x) => x.title).join("; ")}.</p>}
        </Block>
        {item.stakes.length >= 2 && <Block title="What is at stake">
          <ul className="list-disc space-y-0.5 pl-4">{item.stakes.map((w) => <li key={w}>{w}</li>)}</ul>
        </Block>}
      </div>

      {item.lastTime && (
        <details className="group shrink-0 border-t border-line pt-2 text-[13px]" open={item.tier === "watch"}>
          <summary className="flex cursor-pointer list-none items-center gap-1 text-[13px] font-semibold marker:hidden">
            <ChevronRight size={14} className="transition-transform group-open:rotate-90" aria-hidden />
            {item.lastTime.kind === "incident" ? "Last time" : "Lesson from Netherwood"}
            {item.lastTime.prior && <span className="font-normal text-muted-ink"> · <span className="capitalize">{item.lastTime.prior.project}</span>{item.lastTime.confidence ? `, ${item.lastTime.confidence} match` : ""}</span>}
          </summary>
          <div className="mb-0.5 mt-1 flex items-center justify-end">
            {item.lastTime.prior && (
              <Link to={`/project/${item.lastTime.prior.project}?issue=${item.lastTime.prior.id}`} className="text-[12px] text-[#0B6DA6] hover:underline">
                Open the earlier issue at <span className="capitalize">{item.lastTime.prior.project}</span>
              </Link>
            )}
          </div>
          <p>{item.lastTime.text}</p>
          {item.lastTime.prior && (
            <p className="mt-1 text-[12px] text-muted-ink">
              Sources:{" "}
              {item.lastTime.prior.events.map((e, n) => (
                <span key={e.docId + e.date}>
                  {n > 0 && " · "}
                  <button className="text-[#0B6DA6] hover:underline" title={STATUS_WORDS[e.status] ?? e.status} onClick={() => openDrawer({ docId: e.docId, span: e.span })}>{e.docTitle}</button>
                  <span className="num"> ({fmtDate(e.date)})</span>
                </span>
              ))}
            </p>
          )}
          {item.lastTime.lesson && <p className="mt-1 font-medium text-[#8A5A12]">{item.lastTime.lesson}</p>}
          {item.lastTime.matchId && <Relevance id={item.lastTime.matchId} />}
        </details>
      )}

      <IssueTabs issue={issue} />
    </div>
  )
}

function Relevance({ id }: { id: string }) {
  const [v, setV] = useState<string | null>(() => readFb(id))
  return (
    <div className="mt-1 flex items-center gap-1.5 text-[12px]" title="Saved on this device only. A full version would learn from it.">
      <span className="text-muted-ink">Fair comparison?</span>
      {(["relevant", "not relevant"] as const).map((k) => (
        <button key={k} aria-pressed={v === k} onClick={() => { writeFb(id, k); setV(k) }}
          className={cn("rounded-md border px-2 py-px", v === k ? "border-navy-900 bg-navy-900 text-white" : "border-line bg-surface hover:bg-bg")}>
          {k === "relevant" ? "Yes" : "No"}
        </button>
      ))}
    </div>
  )
}
