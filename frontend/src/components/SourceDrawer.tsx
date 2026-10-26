import { useStore } from "@/store"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { DOC_TYPE_LABEL, fmtDate } from "@/lib/format"

export function SourceDrawer() {
  const bundle = useStore((s) => s.bundle)
  const drawer = useStore((s) => s.drawer)
  const open = useStore((s) => s.openDrawer)
  const doc = bundle && drawer ? bundle.documents.find((d) => d.id === drawer.docId) : null

  return (
    <Sheet open={!!doc} onOpenChange={(o) => !o && open(null)}>
      <SheetContent side="right" className="w-[520px]! max-w-none! sm:max-w-none!">
        {doc && (
          <>
            <SheetHeader className="border-b border-line pr-12">
              <SheetTitle>{doc.title}</SheetTitle>
              <SheetDescription>
                {fmtDate(doc.date)} · {doc.project.charAt(0).toUpperCase() + doc.project.slice(1)} · {DOC_TYPE_LABEL[doc.doc_type] ?? doc.doc_type}
              </SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
              <DocText text={doc.text} span={drawer!.span ?? null} />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function DocText({ text, span }: { text: string; span: [number, number] | null }) {
  const [a, b] = span && span[0] < span[1] && span[1] <= text.length ? span : [0, 0]
  return (
    <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink">
      {text.slice(0, a)}
      {b > a && <mark className="rounded-sm bg-blue-500/15 px-0.5 text-ink" ref={(el) => el?.scrollIntoView({ block: "center" })}>{text.slice(a, b)}</mark>}
      {text.slice(b)}
    </p>
  )
}
