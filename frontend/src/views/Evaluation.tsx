import { useStore } from "@/store"
import { fmtDate, pct } from "@/lib/format"
import { Panel } from "@/components/ui-bits"
import { CheckCircle2, XCircle } from "lucide-react"

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between"><span className="text-[13px] font-medium">{label}</span><span className="num font-heading text-[16px] font-semibold">{value}</span></div>
      <p className="text-[12px] text-muted-ink">{note}</p>
    </div>
  )
}

export function Evaluation() {
  const bundle = useStore((s) => s.bundle)!
  const ev = bundle.evaluation
  const title = (goldId: string) => bundle.issues.find((i) => i.gold_id === goldId)?.title ?? goldId
  const lt = ev.lead_time
  const gtDate = lt.ground_truth_date
  const lead = bundle.issues.find((i) => i.id === lt.issue_id)
  const stage28 = bundle.alerts
    .filter((a) => a.issue_id === lt.issue_id && a.rule === "TRIGGER" && a.stage_days === 28)
    .sort((a, b) => a.fired_on.localeCompare(b.fired_on))[0]
  const m = bundle.meta

  return (
    <div className="flex h-full flex-col gap-3">
      <div>
        <h1 className="font-heading text-[18px] font-semibold">How well it worked on the sample</h1>
        <p className="text-[13px] text-muted-ink">
          We compare the system with labels written by a person for the same 12 documents, and measure how early it warned about the Ashfield grid delay.
        </p>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-[auto_1fr] gap-3">
        <Panel className="col-span-2 px-5 py-4">
          <h2 className="text-[13px] font-semibold">Lead time{lead ? `: ${lead.title}` : ""}</h2>
          <div className="mt-3 grid grid-cols-3 gap-6">
            {lt.rows.map((r) => (
              <div key={r.label}>
                <div className="text-[12px] text-muted-ink">{r.label}</div>
                <div className="font-heading text-[20px] font-semibold num">{r.date ? fmtDate(r.date) : "None"}</div>
                <div className="text-[13px]">{r.days_earlier !== null ? `${r.days_earlier} days before the actual escalation (${fmtDate(gtDate)})` : "No alert fired"}</div>
              </div>
            ))}
          </div>
          {stage28 && (
            <p className="mt-3 text-[12px] text-muted-ink">
              Thresholds are settings. With a 4-week warning instead of 8, the first warning moves to {fmtDate(stage28.fired_on)}.
            </p>
          )}
        </Panel>

        <Panel className="px-5 py-4">
          <h2 className="mb-2 text-[13px] font-semibold">Extraction</h2>
          {ev.extraction ? (
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              <Stat label="Recall" value={pct(ev.extraction.mention_recall)} note="Labelled issues the system found." />
              <Stat label="Precision" value={pct(ev.extraction.mention_precision)} note="Extracted issues that match a label." />
              <Stat label="Category" value={pct(ev.extraction.category_accuracy)} note="Matched issues given the right category." />
              <Stat label="Status" value={pct(ev.extraction.status_accuracy)} note="Matched issues given the right status." />
              <Stat label="Trigger dates" value={pct(ev.extraction.trigger_date_accuracy)} note="Declared deadlines read correctly." />
              <Stat label="Quotes" value={pct(ev.extraction.quote_validity)} note="Evidence quotes found in the document." />
            </div>
          ) : (
            <p className="text-[13px] text-muted-ink">This run uses the human labels directly, so there is no extraction to score.</p>
          )}
        </Panel>

        <Panel className="flex flex-col px-5 py-4">
          <h2 className="mb-2 text-[13px] font-semibold">Matching and run</h2>
          {ev.identity && ev.cross_project ? (
            <div className="space-y-2">
              <Stat label="Same issue, precision" value={pct(ev.identity.pairwise_precision)} note="Pairs joined as one issue that really are one." />
              <Stat label="Same issue, recall" value={pct(ev.identity.pairwise_recall)} note="Pairs that are one issue and were joined." />
              <Stat label="Seen before" value={`${ev.cross_project.found} of ${ev.cross_project.expected}`} note={`Expected matches found. ${ev.cross_project.false_positives} false positives.`} />
              <ul className="text-[12px]">
                {ev.cross_project.detail.map((d) => (
                  <li key={d.issue} className="flex items-center gap-1.5">
                    {d.found ? <CheckCircle2 size={13} className="text-green" aria-hidden /> : <XCircle size={13} className="text-red" aria-hidden />}
                    {title(d.issue)} matched to earlier {title(d.prior)}: {d.found ? "found" : "not found"}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-[13px] text-muted-ink">Matching is shown from the human labels in this run.</p>
          )}
          <p className="mt-auto pt-2 text-[12px] text-muted-ink">
            {ev.fallbacks.length ? `Fallbacks: ${ev.fallbacks.join("; ")}` : "No fallbacks used."}
          </p>
          <p className="text-[12px] text-muted-ink">
            Source {ev.source} · {m.model} · prompt {m.prompt_version} · generated {fmtDate(m.generated_at.slice(0, 10))}
          </p>
        </Panel>
      </div>
    </div>
  )
}
