import { useStore } from "@/store"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { DOC_TYPE_LABEL, fmtDate } from "@/lib/format"

export function SourceDrawer() {
  const bundle = useStore((s) => s.bundle)
  const drawer = useStore((s) => s.drawer)
  const open = useStore((s) => s.openDrawer)
  const doc = bundle && drawer ? bundle.documents.find((d) => d.id === drawer.docId) : null
  const span = drawer?.span ?? null

  return (
    <Sheet open={!!doc} onOpenChange={(o) => !o && open(null)}>
      <SheetContent side="right" className="w-[680px]! max-w-none! sm:max-w-none!">
        {doc && (
          <>
            <SheetHeader className="border-b border-line pr-12">
              <SheetTitle>{doc.title}</SheetTitle>
              <SheetDescription>
                {fmtDate(doc.date)} · {doc.project.charAt(0).toUpperCase() + doc.project.slice(1)} · {DOC_TYPE_LABEL[doc.doc_type] ?? doc.doc_type}
              </SheetDescription>
            </SheetHeader>
            <p className="flex items-center gap-2 border-b border-line bg-bg px-4 py-1.5 text-[12px] text-muted-ink">
              {span ? (
                <><span className="inline-block h-3 w-5 rounded-sm bg-[#FFE69A]" aria-hidden />Highlighted: the passage the system used as evidence.</>
              ) : "The whole report, as filed. No single passage is highlighted."}
            </p>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <DocText text={doc.text} span={span} />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

const isHeading = (line: string) => {
  const t = line.trim()
  return (t.length >= 3 && t.length <= 40 && t === t.toUpperCase() && /[A-Z]/.test(t) && !/[a-z]/.test(t)) || /^#{1,3}\s/.test(t)
}

/** The report as written, line by line, with section headings picked out and the evidence passage highlighted. Offsets are unchanged. */
function DocText({ text, span }: { text: string; span: [number, number] | null }) {
  const [a, b] = span && span[0] < span[1] && span[1] <= text.length ? span : [0, 0]
  let pos = 0
  let scrolled = false
  const lines = text.split("\n").map((line) => {
    const start = pos
    pos += line.length + 1
    return { line, start }
  })
  return (
    <div className="text-[14px] leading-relaxed text-ink">
      {lines.map(({ line, start }) => {
        const end = start + line.length
        const hit = b > a && a < end && b > start
        const from = hit ? Math.max(a, start) - start : 0
        const to = hit ? Math.min(b, end) - start : 0
        const first = hit && !scrolled
        if (first) scrolled = true
        return (
          <div key={start} className={isHeading(line) ? "mb-0.5 mt-4 text-[12px] font-semibold tracking-wide text-muted-ink" : "min-h-[1.4em] whitespace-pre-wrap"}>
            {hit ? (
              <>
                {line.slice(0, from)}
                <mark className="rounded-sm bg-[#FFE69A] px-0.5 text-ink [box-decoration-break:clone]" ref={first ? (el) => el?.scrollIntoView({ block: "center" }) : undefined}>{line.slice(from, to)}</mark>
                {line.slice(to)}
              </>
            ) : line}
          </div>
        )
      })}
    </div>
  )
}
