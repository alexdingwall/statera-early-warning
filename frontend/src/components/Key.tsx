import { useEffect, useRef, useState } from "react"
import { Flag, Info } from "lucide-react"
import { PROJECT_COLOUR, SeverityIcon } from "@/components/ui-bits"
import { cn } from "@/lib/utils"

const Row = ({ mark, children }: { mark: React.ReactNode; children: React.ReactNode }) => (
  <li className="flex items-start gap-2.5">
    <span className="mt-[3px] flex w-8 shrink-0 items-center justify-center">{mark}</span>
    <span>{children}</span>
  </li>
)
const Group = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section>
    <h3 className="mb-1 text-[12px] font-semibold text-muted-ink">{title}</h3>
    <ul className="space-y-1">{children}</ul>
  </section>
)
const dot = (c: string) => <span className={cn("inline-block size-2.5 rounded-full", c)} />

/** What the colours and marks mean, one click from anywhere. */
export function Key() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener("keydown", close)
    window.addEventListener("pointerdown", close)
    return () => { window.removeEventListener("keydown", close); window.removeEventListener("pointerdown", close) }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button aria-expanded={open} onClick={() => setOpen(!open)} className="flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-[13px] text-white/90 hover:bg-white/10">
        <Info size={16} aria-hidden />Key
      </button>
      {open && (
        <div role="dialog" aria-label="Key to colours and marks" className="absolute right-0 top-10 z-40 grid w-[760px] grid-cols-2 gap-x-8 gap-y-4 rounded-lg border border-line bg-surface p-5 text-[13px] text-ink shadow-lg">
          <Group title="Warnings and issues">
            <Row mark={<SeverityIcon severity="red" />}>Red: act now. A deadline is close, or it is already affecting the programme.</Row>
            <Row mark={<SeverityIcon severity="amber" />}>Amber: prepare. Raised, but not urgent yet.</Row>
            <Row mark={<SeverityIcon severity="info" />}>Information: a similar problem happened before. Not a warning.</Row>
            <Row mark={<span className="rounded-sm bg-blue-500/15 px-1.5 py-px text-[11px] font-medium text-[#0B6DA6]">New</span>}>Arrived since the previous report.</Row>
          </Group>
          <Group title="Replay bar (top)">
            <Row mark={<span className="flex gap-0.5">{Object.values(PROJECT_COLOUR).map((c) => <span key={c} className="h-4 w-[3px] rounded-sm" style={{ background: c }} />)}</span>}>A report was filed that day, coloured by project: Ashfield blue, Drumgarve green, Netherwood grey. Faded ticks are still to come.</Row>
            <Row mark={<span className="flex gap-1">{dot("bg-red")}{dot("bg-amber")}</span>}>A red or amber warning fired that day.</Row>
            <Row mark={<span className="h-4 w-1.5 rounded-full bg-blue-600" />}>The date you are looking at.</Row>
            <Row mark={<span className="h-4 w-1 bg-navy-900" />}>What actually happened (press G).</Row>
          </Group>
          <Group title="Project dots (left menu)">
            <Row mark={dot("bg-red")}>At risk: a red warning is active.</Row>
            <Row mark={dot("bg-amber")}>Watch: an amber warning is active.</Row>
            <Row mark={dot("bg-green")}>On track: no red or amber warnings.</Row>
          </Group>
          <Group title="Project tiles">
            <Row mark={<span className="rounded-sm bg-bg px-1.5 py-px text-[11px] font-medium text-muted-ink">Reported</span>}>What the project’s own latest report says.</Row>
            <Row mark={<span className="rounded-sm bg-bg px-1.5 py-px text-[11px] font-medium text-muted-ink">Evidence</span>}>What the system finds from all the reports. When the two disagree, the tile says so.</Row>
            <Row mark={<span className="num text-[12px] font-medium text-muted-ink">1–9</span>}>Number keys jump to the menu items. Arrow keys step between reports. Space plays.</Row>
          </Group>
          <Group title="Inside an issue">
            <Row mark={dot("bg-blue-500")}>A report that mentioned the issue.</Row>
            <Row mark={<Flag size={14} className="text-navy-600" aria-hidden />}>A deadline the report itself set.</Row>
            <Row mark={<span className="text-[12px] font-medium text-muted-ink">Faded</span>}>Still ahead of the date you are looking at.</Row>
          </Group>
        </div>
      )}
    </div>
  )
}
