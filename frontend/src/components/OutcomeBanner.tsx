import { useStore } from "@/store"
import { fmtDate } from "@/lib/format"

/** Shown with "what actually happened" on: the real event, and how much earlier the system had warned. */
export function OutcomeBanner() {
  const bundle = useStore((s) => s.bundle)!
  const asOf = useStore((s) => s.asOf)
  const on = useStore((s) => s.groundTruth)
  const e = bundle.ground_truth_events.find((x) => x.date <= asOf)
  if (!on || !e) return null
  const first = bundle.evaluation.lead_time.rows.find((r) => r.label.toLowerCase().includes("first warning"))
  return (
    <div role="status" className="mb-3 flex flex-wrap items-baseline gap-x-2 rounded-lg border border-navy-900 bg-navy-900 px-4 py-2.5 text-[14px] text-white">
      <span className="font-semibold">What actually happened:</span>
      <span>{e.label} on {fmtDate(e.date)}.</span>
      {first?.date && first.days_earlier != null && <span className="font-semibold">The first warning came {first.days_earlier} days earlier, on {fmtDate(first.date)}.</span>}
    </div>
  )
}
