import { useEffect, useRef, useState } from "react"
import { useStore } from "@/store"
import { daysBetween, addDays, fmtDate } from "@/lib/format"
import type { Alert, Doc, Issue, Trigger } from "@/types"

const STATUS_FILL: Record<string, string> = {
  open: "#0E7FC0",
  resolved: "#2F7D57",
  materialised: "#C8372D",
  occurred: "#5B6B82",
}
const STATUS_TEXT: Record<string, string> = { open: "Open", resolved: "Resolved", materialised: "Affected programme", occurred: "Past incident" }
const SEV_FILL = { red: "#C8372D", amber: "#B7791F", info: "#0E7FC0" } as const
const TYPE_SHORT: Record<string, string> = {
  weekly_report: "Weekly", board_update: "Board", site_visit: "Site visit", planning_status: "Planning",
  procurement_issue: "Procurement", handover_status: "Handover", commissioning_summary: "Commissioning",
  lessons_learned: "Lessons", correspondence_summary: "Correspondence",
}

function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(600)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(300, Math.floor(e.contentRect.width))))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

export function IssueTimeline({ issue, asOf, alerts, triggers, docs }: { issue: Issue; asOf: string; alerts: Alert[]; triggers: Trigger[]; docs: Doc[] }) {
  const gt = useStore((s) => s.groundTruth)
  const bundle = useStore((s) => s.bundle)!
  const [ref, W] = useWidth()
  const H = 126
  const padL = 20, padR = 24, axisY = 66

  const mentions = issue.mentions.filter((m) => m.date <= asOf)
  const deadlines = [...new Set(triggers.filter((t) => t.deadline).map((t) => t.deadline!))].sort()
  const gtEvent = gt ? bundle.ground_truth_events.find((e) => e.issue_id === issue.id && e.date <= asOf) : undefined

  const start = addDays(issue.first_seen, -14)
  const end = [asOf, ...deadlines, gtEvent?.date ?? asOf].sort().pop()!
  const span = Math.max(1, daysBetween(start, end))
  const x = (d: string) => padL + (daysBetween(start, d) / span) * (W - padL - padR)
  const docOf = (id: string) => docs.find((d) => d.id === id)

  return (
    <div ref={ref} className="w-full">
      <svg width={W} height={H} role="img" aria-label={`Timeline for ${issue.title}`}>
        <rect x={x(asOf)} y={10} width={Math.max(0, W - padR - x(asOf))} height={axisY - 10 + 36} fill="#F4F6F9" />
        <line x1={padL} x2={W - padR} y1={axisY} y2={axisY} stroke="#C9D1DC" strokeWidth={2} />
        <line x1={padL} x2={x(asOf)} y1={axisY} y2={axisY} stroke="#5B6B82" strokeWidth={2} />
        <text x={x(asOf)} y={H - 2} textAnchor={x(asOf) > W - 80 ? "end" : "middle"} fontSize={11} fill="#5B6B82">As of {fmtDate(asOf)}</text>

        {deadlines.map((d, i) => (
          <g key={d}>
            <line x1={x(d)} x2={x(d)} y1={i % 2 ? 30 : 17} y2={axisY + 14} stroke="#0F1F34" strokeDasharray="4 3" />
            <text x={x(d)} y={12 + (i % 2) * 13} textAnchor={x(d) > W - 150 ? "end" : "middle"} fontSize={11} fill="#0F1F34">
              Deadline set in report · {fmtDate(d)}
            </text>
          </g>
        ))}

        {gtEvent && (
          <g>
            <line x1={x(gtEvent.date)} x2={x(gtEvent.date)} y1={30} y2={axisY + 36} stroke="#0F1F34" strokeWidth={3} />
            <rect x={Math.min(x(gtEvent.date) - 4, W - 190)} y={axisY + 36} width={186} height={18} rx={3} fill="#0F1F34" />
            <text x={Math.min(x(gtEvent.date) - 4, W - 190) + 6} y={axisY + 49} fontSize={11} fill="#fff">Actual escalation {fmtDate(gtEvent.date)}</text>
          </g>
        )}

        {alerts.map((a, i) => {
          const cx = x(a.fired_on)
          const stack = alerts.slice(0, i).filter((o) => Math.abs(x(o.fired_on) - cx) < 14).length
          const top = axisY - 20 - stack * 14
          return (
            <g key={a.id}>
              <title>{`${a.rule} ${a.severity}, ${fmtDate(a.fired_on)}`}</title>
              <line x1={cx} x2={cx} y1={top} y2={axisY - 6} stroke={SEV_FILL[a.severity]} strokeWidth={1.5} />
              <path d={`M${cx},${top} l10,4 l-10,4 z`} fill={SEV_FILL[a.severity]} />
            </g>
          )
        })}

        {mentions.map((m, i) => {
          const d = docOf(m.doc_id)
          const cx = x(m.date)
          return (
            <g key={m.id}>
              <title>{`${d?.title ?? m.doc_id}, ${fmtDate(m.date)}: ${STATUS_TEXT[m.status] ?? m.status}`}</title>
              <circle cx={cx} cy={axisY} r={6} fill={STATUS_FILL[m.status] ?? "#5B6B82"} stroke="#fff" strokeWidth={2} />
              <text x={cx} y={axisY + 20 + (i % 2) * 13} textAnchor={cx < 60 ? "start" : cx > W - 70 ? "end" : "middle"} fontSize={11} fill="#0F1F34">
                {(TYPE_SHORT[d?.doc_type ?? ""] ?? "Report")} {fmtDate(m.date).slice(0, -5)}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="flex gap-3 text-[11px] text-muted-ink">
        {Object.entries(STATUS_TEXT).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1"><span className="inline-block size-2 rounded-full" style={{ background: STATUS_FILL[k] }} />{v}</span>
        ))}
      </div>
    </div>
  )
}
