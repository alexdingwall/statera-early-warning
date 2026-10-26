import { useMemo, useState } from "react"
import { Check, X } from "lucide-react"
import { useStore } from "@/store"
import { fmtDate, VERDICT_WORDS } from "@/lib/format"
import { Panel, PanelTitle, VerdictPill } from "@/components/ui-bits"
import { btnPrimary } from "@/components/ui-bits"
import { cn } from "@/lib/utils"
import type { BoardClaim, Verdict } from "@/types"

const TINT: Record<Verdict, string> = {
  contradicted: "bg-red/15",
  supported_with_caveat: "bg-amber/15",
  supported: "bg-green/15",
  no_evidence: "bg-navy-600/15",
}

const gbp = (n: number) => `£${Math.round(n / 1000)}k`

export function Board() {
  const bundle = useStore((s) => s.bundle)!
  const { asOf, setAsOf, openDrawer } = useStore()
  const check = bundle.board_checks[0]
  const doc = bundle.documents.find((d) => d.id === check?.doc_id)
  const [sel, setSel] = useState<string | null>(null)

  const claims = check?.claims ?? []
  const selected: BoardClaim | undefined =
    claims.find((c) => c.id === sel) ?? claims.find((c) => c.verdict === "contradicted" && c.section === "Risks") ?? claims.find((c) => c.verdict === "contradicted") ?? claims[0]

  const mentionIndex = useMemo(() => {
    const m = new Map<string, { date: string; docId: string; quote: string | null; span: [number, number] | null }>()
    for (const i of bundle.issues) for (const x of i.mentions) m.set(x.id, { date: x.date, docId: x.doc_id, quote: x.evidence_quote, span: x.quote_span })
    return m
  }, [bundle])

  if (!check || !doc) return <Panel className="p-6 text-[14px] text-muted-ink">No board paper in this run.</Panel>

  if (asOf < check.as_of) {
    return (
      <Panel className="flex h-full flex-col items-start gap-3 p-6">
        <h1 className="font-heading text-[16px] font-semibold">Board check</h1>
        <p className="text-[14px]">The June board paper is dated {fmtDate(check.as_of)}. Move the date forward to check it.</p>
        <button className={btnPrimary} onClick={() => setAsOf(check.as_of)}>Go to {fmtDate(check.as_of)}</button>
      </Panel>
    )
  }

  const b = check.budget
  const evidence = (selected?.evidence_mention_ids ?? []).map((id) => mentionIndex.get(id)).filter((x): x is NonNullable<typeof x> => !!x && x.date <= check.as_of)

  return (
    <div className="flex items-start gap-3">
      <h1 className="sr-only">Board check</h1>
      <Panel className="flex w-[55%] flex-col">
        <PanelTitle>{doc.title}</PanelTitle>
        <div className="min-h-0 flex-1 overflow-hidden px-5 pb-3">
          <PaperText text={doc.text} claims={claims} selectedId={selected?.id} onSelect={setSel} />
        </div>
      </Panel>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <Panel className="flex min-h-0 flex-1 flex-col px-4 py-3">
          {selected && (
            <>
              <div className="flex items-center gap-2">
                <VerdictPill verdict={selected.verdict} />
                {selected.fallback && <span className="rounded-sm bg-bg px-1.5 py-0.5 text-[11px] text-muted-ink">Gold label used</span>}
              </div>
              <p className="mt-2 text-[14px] font-medium">“{selected.text}”</p>
              <p className="mt-1 text-[13px] text-muted-ink">{selected.reason}</p>
              <h3 className="mt-3 text-[12px] font-medium text-muted-ink">Evidence held on {fmtDate(check.as_of)}</h3>
              {evidence.length === 0 ? (
                <p className="mt-1 text-[13px] text-muted-ink">No evidence items cited.</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {evidence.slice(0, 4).map((e, i) => {
                    const d = bundle.documents.find((x) => x.id === e.docId)!
                    return (
                      <li key={i}>
                        <button onClick={() => openDrawer({ docId: e.docId, span: e.span })} className="grid w-full grid-cols-[84px_1fr] gap-x-2 rounded-sm px-1 py-0.5 text-left text-[13px] hover:bg-bg">
                          <span className="num text-muted-ink">{fmtDate(e.date)}</span>
                          <span className="min-w-0"><span className="font-medium">{d.title}</span>{e.quote && <span className="block text-[12px] text-muted-ink">“{e.quote.replace(/\*\*/g, "")}”</span>}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
              <p className="mt-auto pt-2 text-[12px] text-muted-ink">Checked using documents up to {fmtDate(check.as_of)} only.</p>
            </>
          )}
        </Panel>
        <Panel className="shrink-0 px-4 py-3">
          <h3 className="mb-1 text-[13px] font-semibold">Budget: £{Math.round(b.stated_total / 1000)}k above baseline</h3>
          <ul className="text-[13px]">
            {b.items.map((i) => (
              <li key={i.label} className="flex justify-between"><span>{i.label}</span><span className="num">{gbp(i.amount)}</span></li>
            ))}
          </ul>
          <p className="mt-1 text-[12px] text-muted-ink num">
            Stated {gbp(b.stated_total)} · computed {gbp(b.computed_total)}{" "}
            <span className="inline-flex items-center gap-0.5">{b.matches ? <Check size={12} aria-hidden /> : <X size={12} aria-hidden />}{b.matches ? "matches" : "does not match"}</span>
          </p>
          {b.flag_vague && (
            <p className="text-[12px] font-medium text-[#8A5A12]">
              Largest item: {b.largest_label} ({Math.round(b.largest_share * 100)}% of overrun). Label gives no detail.
            </p>
          )}
        </Panel>
      </div>
    </div>
  )
}

function PaperText({ text, claims, selectedId, onSelect }: { text: string; claims: BoardClaim[]; selectedId?: string; onSelect: (id: string) => void }) {
  const lines: { start: number; end: number }[] = []
  let pos = 0
  for (const l of text.split("\n")) { lines.push({ start: pos, end: pos + l.length }); pos += l.length + 1 }
  const clean = (s: string) => s.replace(/\*\*/g, "")

  return (
    <div className="text-[14px] leading-snug">
      {lines.map((ln, idx) => {
        const raw = text.slice(ln.start, ln.end)
        if (!raw.trim()) return <div key={idx} className="h-1.5" />
        let a = ln.start
        let kind: "h1" | "h2" | "li" | "p" = "p"
        if (raw.startsWith("# ")) { kind = "h1"; a += 2 }
        else if (raw.startsWith("## ")) { kind = "h2"; a += 3 }
        else if (raw.startsWith("- ")) { kind = "li"; a += 2 }
        const segs: React.ReactNode[] = []
        let cur = a
        const inLine = claims.filter((c) => c.span[1] > a && c.span[0] < ln.end).sort((x, y) => x.span[0] - y.span[0])
        for (const c of inLine) {
          const s = Math.max(c.span[0], cur), e = Math.min(c.span[1], ln.end)
          if (s > cur) segs.push(clean(text.slice(cur, s)))
          segs.push(
            <button key={c.id} onClick={() => onSelect(c.id)} aria-pressed={selectedId === c.id}
              className={cn("inline rounded-sm px-0.5 text-left", TINT[c.verdict], selectedId === c.id && "ring-2 ring-navy-900")}
              title={VERDICT_WORDS[c.verdict]}>
              {clean(text.slice(s, e))}
            </button>,
          )
          cur = e
        }
        if (cur < ln.end) segs.push(clean(text.slice(cur, ln.end)))
        const cls = kind === "h1" ? "font-heading text-[15px] font-semibold pb-1" : kind === "h2" ? "font-heading text-[13px] font-semibold pt-1.5" : kind === "li" ? "pl-4 -indent-3" : ""
        return <div key={idx} className={cls}>{kind === "li" && "• "}{segs}</div>
      })}
    </div>
  )
}
