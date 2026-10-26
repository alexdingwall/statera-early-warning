import { BellOff, Check, ChevronRight, History, Megaphone } from "lucide-react"
import { Link } from "react-router-dom"
import { useStore } from "@/store"
import { ageText, categoryLabel, fmtDate } from "@/lib/format"
import { STATE_WORDS, type ActionItem, type ActionState } from "@/lib/actions"
import { SeverityIcon, btn, btnPrimary } from "@/components/ui-bits"

export function ActionButtons({ item, compact }: { item: ActionItem; compact?: boolean }) {
  const rec = useStore((s) => s.actions[item.issue.id])
  const asOf = useStore((s) => s.asOf)
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
    <div className="flex gap-2">
      <button className={`${btnPrimary} ${size}`} onClick={() => set("escalated")}><Megaphone size={14} aria-hidden />Escalate</button>
      <button className={`${btn} ${size}`} onClick={() => set("acknowledged")}><Check size={14} aria-hidden />Acknowledge</button>
      <button className={`${btn} ${size}`} onClick={() => set("snoozed")}><BellOff size={14} aria-hidden />Snooze</button>
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
  const bundle = useStore((s) => s.bundle)!
  const openDrawer = useStore((s) => s.openDrawer)
  const { issue } = item
  const cp = issue.counterparty ? bundle.counterparties[issue.counterparty]?.label : null
  const latest = issue.mentions.filter((m) => m.date <= asOf).slice(-1)[0]

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden p-4">
      <div className="flex items-start gap-2">
        <span className="mt-0.5"><SeverityIcon severity={item.severity} size={18} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-semibold leading-snug">{issue.title}</h2>
          <p className="text-[12px] text-muted-ink">
            <span className="capitalize">{item.project}</span> · {categoryLabel(issue.category)}{cp ? ` · ${cp}` : ""} · {ageText(issue.first_seen, asOf)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5 text-[12px]">
          <Link to={`/project/${item.project}?issue=${issue.id}`} className="flex items-center gap-0.5 text-[#0B6DA6] hover:underline">
            Timeline and evidence <ChevronRight size={13} aria-hidden />
          </Link>
          {latest && <button className="text-[#0B6DA6] hover:underline" onClick={() => openDrawer({ docId: latest.doc_id, span: latest.quote_span })}>Latest source document</button>}
        </div>
      </div>

      <div className="shrink-0 rounded-md border border-blue-500/40 bg-blue-500/5 p-3">
        <h3 className="mb-1 text-[12px] font-semibold text-[#0B6DA6]">Recommended action</h3>
        <p className="text-[15px] font-semibold leading-snug">{item.action}</p>
        <p className="mt-1 text-[12px] text-muted-ink">
          {item.owner ? `Suggested owner: ${item.owner}` : ""}{item.decideBy ? ` · decide by ${fmtDate(item.decideBy)}` : ""}
        </p>
        <div className="mt-2.5"><ActionButtons item={item} /></div>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-5 text-[13px]">
        <Block title="Why now">
          <ul className="list-disc space-y-0.5 pl-4">
            {item.why.slice(0, 3).map((w) => <li key={w}>{w}</li>)}
          </ul>
        </Block>
        <Block title="What is at stake">
          {item.stakes.length ? (
            <ul className="list-disc space-y-0.5 pl-4">{item.stakes.map((w) => <li key={w}>{w}</li>)}</ul>
          ) : <p className="text-muted-ink">No programme figures reported yet.</p>}
        </Block>
      </div>

      {item.lastTime && (
        <div className="shrink-0 rounded-md bg-bg p-3 text-[13px]">
          <h3 className="mb-0.5 flex items-center gap-1 text-[12px] font-semibold text-muted-ink"><History size={13} aria-hidden />{item.lastTime.kind === "incident" ? "Last time" : "Lesson from Netherwood"}</h3>
          <p className="line-clamp-2">{item.lastTime.text}</p>
          {item.lastTime.lesson && <p className="mt-0.5 font-medium text-[#8A5A12]">{item.lastTime.lesson}</p>}
        </div>
      )}

    </div>
  )
}
