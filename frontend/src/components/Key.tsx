import { useEffect, useRef, useState } from "react"
import { Flag, Info } from "lucide-react"
import { PROJECT_COLOUR, SeverityIcon } from "@/components/ui-bits"
import { cn } from "@/lib/utils"

const Row = ({ mark, children }: { mark: React.ReactNode; children: React.ReactNode }) => (
  <li className="flex items-start gap-2.5">
    <span className="mt-[3px] flex w-14 shrink-0 items-center justify-center">{mark}</span>
    <span>{children}</span>
  </li>
)
const Group = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section>
    <h3 className="mb-1 text-[12px] font-semibold text-muted-ink">{title}</h3>
    <ul className="space-y-1">{children}</ul>
  </section>
)
const Term = ({ word, children }: { word: string; children: React.ReactNode }) => (
  <li><span className="font-semibold">{word}</span> <span className="text-muted-ink">{children}</span></li>
)
const dot = (c: string) => <span className={cn("inline-block size-2.5 rounded-full", c)} />

type Tab = "about" | "how" | "key"
const TABS: { id: Tab; label: string }[] = [{ id: "about", label: "About" }, { id: "how", label: "How to use" }, { id: "key", label: "Key" }]

const Step = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
  <li className="flex gap-3">
    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-navy-900 text-[12px] font-semibold text-white">{n}</span>
    <span><span className="font-semibold">{title}</span> <span className="text-muted-ink">{children}</span></span>
  </li>
)

function About() {
  return (
    <div className="space-y-3 text-[13px] leading-relaxed">
      <p className="text-[15px] font-semibold leading-snug">Early Warning reads a project’s reports, follows every issue from one report to the next, and tells the project manager what to decide this week.</p>
      <div className="grid grid-cols-2 gap-x-8 gap-y-3">
        <section>
          <h3 className="mb-1 text-[12px] font-semibold text-muted-ink">What it is useful for</h3>
          <ul className="list-disc space-y-1 pl-4">
            <li>Catching an issue that keeps coming back, before it costs time.</li>
            <li>Seeing which projects are really at risk, not just what the report says.</li>
            <li>Checking a board paper against the evidence held on that date.</li>
            <li>Warning a project before a supplier or contractor repeats a problem from another project.</li>
          </ul>
        </section>
        <section>
          <h3 className="mb-1 text-[12px] font-semibold text-muted-ink">What you are looking at</h3>
          <ul className="list-disc space-y-1 pl-4">
            <li>Twelve synthetic reports from three projects, December 2024 to July 2025.</li>
            <li>A replay: every screen shows only what was known on the date you pick.</li>
            <li>A local AI model reads the reports. Plain rules, not the AI, raise the warnings, and each explains itself.</li>
          </ul>
        </section>
      </div>
      <p className="rounded-md bg-bg px-3 py-2 text-muted-ink">A proof of concept. It only knows what is in the reports, and it was tested on this one sample. The Evaluation page shows where it is weak.</p>
    </div>
  )
}

function How() {
  return (
    <ol className="space-y-2.5 text-[13px] leading-relaxed">
      <Step n={1} title="Pick a date.">The bar at the top is the replay. Press the left and right arrow keys to step between reports, Space to play, or use “Jump to” for the key moments.</Step>
      <Step n={2} title="Start on the Portfolio.">“Needs a decision” lists what to act on, most urgent first. Click one to see the recommended action, why now, what is at stake, and what happened last time.</Step>
      <Step n={3} title="Make a decision.">Mark as escalated, acknowledge or snooze. It is saved in your browser only and nothing is sent. If a later report mentions the issue, it comes back with the reason.</Step>
      <Step n={4} title="Check the evidence.">Click any report in an issue’s History to open it, with the passage the system used highlighted.</Step>
      <Step n={5} title="Look around.">Board check tests a board paper against the evidence. Evaluation shows how well it worked. Press G to see what actually happened.</Step>
      <Step n={6} title="Add a report.">On a computer with the backend running, add a new report and see what the model finds and what changes. The hosted copy is read-only.</Step>
    </ol>
  )
}

function KeyTab() {
  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-[13px]">
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
            <Term word="Reported">what the project’s own latest report says.</Term>
            <Term word="Evidence">what the system finds from all the reports. When the two disagree, the tile says so.</Term>
          </Group>
          <Group title="Inside an issue">
            <Row mark={dot("bg-blue-500")}>A report that mentioned the issue.</Row>
            <Row mark={<Flag size={14} className="text-navy-600" aria-hidden />}>A deadline the report itself set.</Row>
            <Row mark={<span className="text-[12px] font-medium text-muted-ink">Faded</span>}>Still ahead of the date you are looking at.</Row>
          </Group>
          <Group title="Keyboard">
            <Term word="← →">step between reports.</Term>
            <Term word="Space">play or pause the replay.</Term>
            <Term word="1 to 9">jump to a menu item.</Term>
            <Term word="G">show what actually happened.</Term>
            <Term word="?">open or close this panel.</Term>
          </Group>
    </div>
  )
}

/** About, how to use, and what the colours mean, one click (or ?) from anywhere. */
export function Help() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>("about")
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (e.key === "Escape") setOpen(false)
      else if (e.key === "?" && !["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName)) setOpen((o) => !o)
    }
    const onDown = (e: PointerEvent) => { if (open && !ref.current?.contains(e.target as Node)) setOpen(false) }
    window.addEventListener("keydown", onKey)
    window.addEventListener("pointerdown", onDown)
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("pointerdown", onDown) }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button aria-expanded={open} onClick={() => setOpen(!open)} className="flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-[13px] text-white/90 hover:bg-white/10">
        <Info size={16} aria-hidden />How to use
      </button>
      {open && (
        <div role="dialog" aria-label="About and how to use" className="absolute right-0 top-10 z-40 w-[760px] rounded-lg border border-line bg-surface p-5 text-ink shadow-lg">
          <div role="tablist" className="mb-4 flex gap-1 border-b border-line">
            {TABS.map((t) => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                className={cn("-mb-px border-b-2 px-3 py-1.5 text-[13px]", tab === t.id ? "border-blue-500 font-medium text-ink" : "border-transparent text-muted-ink hover:text-ink")}>{t.label}</button>
            ))}
            <span className="ml-auto self-center pb-1 text-[12px] text-muted-ink">Press ? to open or close · Esc to close</span>
          </div>
          {tab === "about" ? <About /> : tab === "how" ? <How /> : <KeyTab />}
        </div>
      )}
    </div>
  )
}
