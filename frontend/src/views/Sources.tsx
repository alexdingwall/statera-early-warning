import { useStore } from "@/store"
import { DOC_TYPE_LABEL, fmtDate } from "@/lib/format"
import { Panel, PROJECT_COLOUR } from "@/components/ui-bits"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export function Sources() {
  const bundle = useStore((s) => s.bundle)!
  const openDrawer = useStore((s) => s.openDrawer)
  const rows = [...bundle.documents].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  return (
    <Panel className="flex flex-col">
      <h1 className="px-4 py-2.5 font-heading text-[16px] font-semibold">Sources ({rows.length} documents)</h1>
      <div className="min-h-0 flex-1 overflow-hidden px-2">
        <table className="w-full table-fixed text-[13px]">
          <thead>
            <tr className="h-8 border-b border-line text-left text-[12px] text-muted-ink">
              <th className="w-[104px] px-2 font-medium">Date</th>
              <th className="w-[104px] px-2 font-medium">Project</th>
              <th className="w-[160px] px-2 font-medium">Type</th>
              <th className="px-2 font-medium">Title</th>
              <th className="w-[130px] px-2 font-medium">Author</th>
              <th className="w-[130px] px-2 font-medium">Use</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} onClick={() => openDrawer({ docId: d.id })} className="h-[34px] cursor-pointer border-b border-line/60 hover:bg-bg">
                <td className="num px-2">
                  {d.date_note ? (
                    <Tooltip>
                      <TooltipTrigger render={<span tabIndex={0} className="underline decoration-dotted" />}>{fmtDate(d.date)}</TooltipTrigger>
                      <TooltipContent>{d.date_note}</TooltipContent>
                    </Tooltip>
                  ) : fmtDate(d.date)}
                </td>
                <td className="px-2"><span className="mr-1.5 inline-block size-2 rounded-full" style={{ background: PROJECT_COLOUR[d.project] }} />{d.project.charAt(0).toUpperCase() + d.project.slice(1)}</td>
                <td className="truncate px-2">{DOC_TYPE_LABEL[d.doc_type] ?? d.doc_type}</td>
                <td className="truncate px-2">
                  <button className="truncate text-left hover:underline focus-visible:underline" onClick={(e) => { e.stopPropagation(); openDrawer({ docId: d.id }) }}>{d.title}</button>
                </td>
                <td className="truncate px-2 text-muted-ink">{d.author ?? "—"}</td>
                <td className="px-2">
                  {d.replay_excluded && (
                    <Tooltip>
                      <TooltipTrigger render={<span tabIndex={0} className="rounded-sm bg-navy-600/10 px-1.5 py-0.5 text-[12px] text-navy-600" />}>Not used in replay</TooltipTrigger>
                      <TooltipContent>{d.excluded_reason}</TooltipContent>
                    </Tooltip>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}
